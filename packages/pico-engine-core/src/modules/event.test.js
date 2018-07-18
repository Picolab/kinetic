//var _ = require("lodash");
var test = require("tape");
var http = require("http");
var event_module = require("./event");

test("module - event:attr(name)", function(t){
    (async function(){
        var kevent = event_module();

        t.equals(
            await kevent.def.attr({event: {attrs: {foo: "bar"}}}, ["foo"]),
            "bar"
        );

        //just null if no ctx.event, or it doesn't match
        t.equals(await kevent.def.attr({}, ["baz"]), null);
        t.equals(
            await kevent.def.attr({event: {attrs: {foo: "bar"}}}, ["baz"]),
            null
        );

    }()).then(t.end).catch(t.end);
});

test("module - event:send(event, host = null)", function(t){
    var server_reached = false;
    var server = http.createServer(function(req, res){
        server_reached = true;

        var body = "";
        req.on("data", function(buffer){
            body += buffer.toString();
        });
        req.on("end", function(){
            t.equals(req.url, "/sky/event/some-eci/none/some-d/some-t");
            t.equals(body, "{\"foo\":{},\"bar\":[],\"baz\":{\"q\":\"[Function]\"}}");

            res.end();
            server.close();
            t.end();
        });
    });
    server.listen(0, function(){
        var host = "http://localhost:" + server.address().port;
        (async function(){

            var kevent = event_module();

            t.equals(
                (await kevent.def.send({}, {
                    event: {
                        eci: "some-eci",
                        domain: "some-d",
                        type: "some-t",
                        attrs: {foo: {}, bar: [], baz: {"q": function(){}}},
                    },
                    host: host,
                }))[0],
                void 0//returns nothing
            );
            t.equals(server_reached, false, "should be async, i.e. server not reached yet");
        }()).catch(t.end);
    });
});
