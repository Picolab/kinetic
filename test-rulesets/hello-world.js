module.exports = {
  "rid": "io.picolabs.hello_world",
  "version": "0.0.0",
  "meta": {
    "name": "Hello World",
    "description": "\nA first ruleset for the Quickstart\n    ",
    "author": "Phil Windley",
    "shares": [
      "hello",
      "said"
    ]
  },
  "init": async function ($rsCtx, $env) {
    const $ctx = $env.mkCtx($rsCtx);
    const hello = $env.krl.function(["name"], async function (name = "default") {
      const msg = await $ctx.module("stdlib")["+"]($ctx, [
        "Hello ",
        name
      ]);
      return msg;
    });
    const said = $env.krl.function([], async function () {
      return await $ctx.getEnt("said");
    });
    const $rs = new $env.SelectWhen.SelectWhen();
    $rs.when($env.SelectWhen.e("say:hello"), async function ($event, $state) {
      var fired = true;
      if (fired)
        $ctx.log("debug", "fired");
      else
        $ctx.log("debug", "not fired");
      await $ctx.putEnt("said", await $ctx.module("stdlib")["get"]($ctx, [
        $event.data.attrs,
        "name"
      ]));
    });
    return {
      "event": async function (event) {
        await $rs.send(event);
      },
      "query": {
        "hello": function ($args) {
          return hello($ctx, $args);
        },
        "said": function ($args) {
          return said($ctx, $args);
        },
        "__testing": function () {
          return {
            "queries": [
              {
                "name": "hello",
                "args": ["name"]
              },
              {
                "name": "said",
                "args": []
              }
            ],
            "events": [{
                "domain": "say",
                "name": "hello",
                "attrs": ["name"]
              }]
          };
        }
      }
    };
  }
};
