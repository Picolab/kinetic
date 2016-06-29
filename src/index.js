var _ = require('lodash');
var λ = require('contra');
var DB = require('./DB');
var evalRule = require('./evalRule');
var selectRulesToEval = require('./selectRulesToEval');

var rulesets = {};
var salience_graph = {};
var installRuleset = function(path){
  var rs = require('./rulesets/' + path);
  rs.rid = rs.name;
  _.each(rs.rules, function(rule, rule_name){
    rule.rid = rs.rid;
    rule.rule_name = rule_name;

    _.each(rule.select && rule.select.graph, function(g, domain){
      _.each(g, function(exprs, type){
        _.set(salience_graph, [domain, type, rule.rid, rule.rule_name], true);
      });
    });
  });
  rulesets[rs.rid] = rs;
};

installRuleset('hello-world');
installRuleset('events');
installRuleset('persistent');

module.exports = function(conf){
  var db = DB(conf.db);

  return {
    db: db,
    signalEvent: function(event, callback){
      event.timestamp = new Date();
      db.getPicoByECI(event.eci, function(err, pico){
        if(err) return callback(err);

        var ctx_orig = {
          pico: pico,
          db: db,
          vars: {},
          event: event
        };

        selectRulesToEval(ctx_orig, salience_graph, rulesets, function(err, to_eval){
          if(err) return callback(err);

          λ.map(to_eval, function(rule, callback){

            var ctx = _.cloneDeep(ctx_orig);
            ctx.rid = rule.rid;
            ctx.rule = rule;

            evalRule(rule, ctx, callback);
          }, function(err, responses){
            if(err) return callback(err);

            var res_by_type = _.groupBy(_.flattenDeep(responses), 'type');

            //TODO other types
            callback(undefined, {
              directives:  _.map(res_by_type.directive, function(d){
                return _.omit(d, 'type');
              })
            });
          });
        });
      });
    },
    callFunction: function(query, callback){

      var ctx_orig = {
        eci: query.eci,
        rid: query.rid,
        fn_name: query.fn_name,
        args: query.args
      };

      db.getPicoByECI(ctx_orig.eci, function(err, pico){
        if(err) return callback(err);
        var ctx = _.assign({}, ctx_orig, {
          db: db,
          pico: pico
        });
        if(!ctx.pico){
          return callback(new Error('Bad eci'));
        }
        if(!_.has(ctx.pico.ruleset, ctx.rid)){
          return callback(new Error('Pico does not have that rid'));
        }
        if(!_.has(rulesets, ctx.rid)){
          return callback(new Error('Not found: rid'));
        }
        var fun = _.get(rulesets, [ctx.rid, 'meta', 'shares', ctx.fn_name]);
        if(!_.isFunction(fun)){
          return callback(new Error('Function not shared: ' + ctx.fn_name));
        }
        fun(ctx, callback);
      });
    }
  };
};
