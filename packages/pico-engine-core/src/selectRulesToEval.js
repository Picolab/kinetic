var _ = require("lodash");
var async = require("async");
var ktypes = require("krl-stdlib/types");
var runKRL = require("./runKRL");
var aggregateEvent = require("./aggregateEvent");

var getAttrString = function(ctx, attr){
    return _.has(ctx, ["event", "attrs", attr])
        ? ktypes.toString(ctx.event.attrs[attr])
        : "";
};

async function evalExpr(ctx, rule, aggregator, exp, setting){
    var recur = function(e){
        return evalExpr(ctx, rule, aggregator, e, setting);
    };
    if(_.isArray(exp)){
        if(exp[0] === "not"){
            return !(await recur(exp[1]));
        }else if(exp[0] === "and"){
            return (await recur(exp[1])) && (await recur(exp[2]));
        }else if(exp[0] === "or"){
            return (await recur(exp[1])) || (await recur(exp[2]));
        }
    }
    //only run the function if the domain and type match
    var domain = ctx.event.domain;
    var type = ctx.event.type;
    if(_.get(rule, ["select", "graph", domain, type, exp]) !== true){
        return false;
    }
    return await runKRL(rule.select.eventexprs[exp], ctx, aggregator, getAttrString, setting);
}

async function getNextState(ctx, rule, curr_state, aggregator, setting){
    var stm = rule.select.state_machine[curr_state];

    var i;
    for(i=0; i < stm.length; i++){
        if(await evalExpr(ctx, rule, aggregator, stm[i][0], setting)){
            //found a match
            return stm[i][1];
        }
    }
    if(curr_state === "end"){
        return "start";
    }
    return curr_state;//by default, stay on the current state
}

async function shouldRuleSelect(core, ctx, rule){

    var sm_data = await core.db.getStateMachineYieldable(ctx.pico_id, rule);

    var bindings = sm_data.bindings || {};

    if(_.isFunction(rule.select && rule.select.within)){

        if(!_.isNumber(sm_data.starttime)){
            sm_data.starttime = ctx.event.timestamp.getTime();
        }
        var time_since_last = ctx.event.timestamp.getTime() - sm_data.starttime;

        // restore any stored variables in a temporary scope
        var ctx2 = core.mkCTX(_.assign({}, ctx, {
            scope: ctx.scope.push(),
        }));
        _.each(bindings, function(val, id){
            ctx2.scope.set(id, val);
        });
        var time_limit = await runKRL(rule.select.within, ctx2);

        if(time_since_last > time_limit){
            // time has expired, reset the state machine
            sm_data.state = "start";
        }
        if(sm_data.state === "start"){
            // set or reset the clock
            sm_data.starttime = ctx.event.timestamp.getTime();
            bindings = {};
        }
    }

    // restore any variables that were stored
    _.each(bindings, function(val, id){
        ctx.scope.set(id, val);
    });

    var aggregator = aggregateEvent(core, sm_data.state, rule);

    var setting = function(id, val){
        ctx.scope.set(id, val);
        bindings[id] = val;
    };

    var next_state = await getNextState(ctx, rule, sm_data.state, aggregator, setting);

    await core.db.putStateMachineYieldable(ctx.pico_id, rule, {
        state: next_state,
        starttime: sm_data.starttime,
        bindings: next_state === "end"
            ? {}
            : bindings,
    });

    return next_state === "end";
}

var selectForPico = function(core, ctx, pico_rids, callback){

    var rules_to_select = core.rsreg.salientRules(ctx.event.domain, ctx.event.type, function(rid){
        if(pico_rids[rid] !== true){
            return false;
        }
        if(_.has(ctx.event, "for_rid") && _.isString(ctx.event.for_rid)){
            if(rid !== ctx.event.for_rid){
                return false;
            }
        }
        return true;
    });

    async.filter(rules_to_select, function(rule, next){
        var ruleCTX = core.mkCTX({
            rid: rule.rid,
            scope: rule.scope,
            event: ctx.event,
            pico_id: ctx.pico_id,
            rule_name: rule.name,
        });
        shouldRuleSelect(core, ruleCTX, rule)
            .then(function(data){
                next(null, data);
            })
            .catch(next);
    }, function(err, rules){
        if(err){
            process.nextTick(function(){
                //wrapping in nextTick resolves strange issues with UnhandledPromiseRejectionWarning
                //when infact we are handling the rejection
                callback(err);
            });
            return;
        }
        //rules in the same ruleset must fire in order
        callback(void 0, _.reduce(_.groupBy(rules, "rid"), function(acc, rules){
            return acc.concat(rules);
        }, []));
    });
};

module.exports = function(core, ctx, callback){
    //read this fresh everytime we select, b/c it might have changed during event processing
    core.db.ridsOnPico(ctx.pico_id, function(err, pico_rids){
        if(err) return callback(err);
        selectForPico(core, ctx, pico_rids, callback);
    });
};
