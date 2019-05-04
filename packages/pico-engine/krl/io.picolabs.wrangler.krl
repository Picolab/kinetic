/* Rules with a public facing point of entry are camelCase, internal rules are snake_case
   For skyQuery and parent-child trees: 
    wrangler is built so that the parent can skyQuery its children for info at any time, 
    but children only get information from the parent through event-passing to prevent race conditions 
*/
ruleset io.picolabs.wrangler {
  meta {
    name "Wrangler Core"
    description <<
      Wrangler Core Module,
      use example, use module v1_wrangler alias wrangler .
      This Ruleset/Module provides a developer interface to the PICO (persistent computer object).
      When a PICO is created or authenticated this ruleset will be installed to provide essential
      services.
    >>
    author "BYU Pico Lab"

    logging on
    provides skyQuery ,
    rulesetsInfo,installedRulesets, installRulesets, uninstallRulesets,registeredRulesets, //ruleset
    channel, alwaysEci, eciFromName, nameFromEci, createChannel, newPolicy,//channel
    children, parent_eci, name, profile, pico, randomPicoName, deleteChild, pico, myself, isMarkedForDeath
    shares skyQuery ,
    rulesetsInfo,installedRulesets,registeredRulesets, //ruleset
    channel, alwaysEci, eciFromName, nameFromEci,//channel
    children, parent_eci, name, profile, pico, randomPicoName, pico,  myself, id, MAX_RAND_ENGL_NAMES, test, isMarkedForDeath, getPicoMap,
     __testing
  }
  global {
    __testing = { "queries": [  { "name": "channel", "args":["value","collection","filtered"] },
                                {"name":"skyQuery" , "args":["eci", "mod", "func", "params","_host","_path","_root_url"]},
                                {"name":"children" , "args":[]},
                                {"name":"test" , "args":[]}],
                  "events": [
                              { "domain": "wrangler", "type": "child_creation",
                                "attrs": [ "name" , "rids"] },
                              { "domain": "wrangler", "type": "child_deletion",
                                "attrs": [ "name","id","delete_all"] },
                              { "domain": "wrangler", "type": "child_deletion",
                              "attrs": [ "id"] },
                              { "domain": "wrangler", "type": "child_deletion",
                              "attrs": [ "delete_all"] },
                              { "domain": "wrangler", "type": "force_child_deletion",
                              "attrs": [ "delete_all"] },
                              { "domain": "wrangler", "type": "child_sync",
                              "attrs": [ ] },
                              { "domain": "wrangler", "type": "channel_creation_requested",
                                "attrs": [ "name", "channel_type" ] },
                              { "domain": "wrangler", "type": "channel_deletion_requested",
                                "attrs": [ "eci" ] },
                              { "domain": "wrangler", "type": "install_rulesets_requested",
                                "attrs": [ "rids","url" ] },
                              { "domain": "wrangler", "type": "deletion_requested",
                                "attrs": [ ] } ] }
                                
  test = function() {
   //engine:listChannels(meta:picoId)[0]
   //engine:getPicoIDByECI("a");
   skyQuery(meta:eci, "io.picolabs.wrangler", "myself");
  // ent:wrangler_children;
  // engine:listChildren().length()
    engine:listChannels(ent:id)
  }
// ********************************************************************************************
// ***                                                                                      ***
// ***                                      FUNCTIONS                                       ***
// ***                                                                                      ***
// ********************************************************************************************

  config= {"os_rids"        : [/*"io.picolabs.pds",*/"io.picolabs.wrangler","io.picolabs.visual_params"],
           "connection_rids": ["io.picolabs.subscription"] }
           
  /*
       skyQuery is used to programmatically call function inside of other picos from inside a rule.
       parameters;
          eci - The eci of the pico which contains the function to be called
          mod - The ruleset ID or alias of the module
          func - The name of the function in the module
          params - The parameters to be passed to function being called
          optional parameters
          _host - The host of the pico engine being queried.
                  Note this must include protocol (http:// or https://) being used and port number if not 80.
                  For example "http://localhost:8080", which also is the default.
          _path - The sub path of the url which does not include mod or func.
                  For example "/sky/cloud/", which also is the default.
          _root_url - The entire url except eci, mod , func.
                  For example, dependent on _host and _path is
                  "http://localhost:8080/sky/cloud/", which also is the default.
       skyQuery on success (if status code of request is 200) returns results of the called function.
       skyQuery on failure (if status code of request is not 200) returns a Map of error information which contains;
               error - general error message.
               httpStatus - status code returned from http get command.
               skyQueryError - The value of the "error key", if it exist, aof the function results.
               skyQueryErrorMsg - The value of the "error_str", if it exist, of the function results.
               skyQueryReturnValue - The function call results.
     */
     QUERY_SELF_INVALID_HTTP_MAP = {"status_code": 400, 
                                    "status_line":"HTTP/1.1 400 Pico should not query itself",
                                    "content": "{\"error\":\"Pico should not query itself\"}"};
     skyQuery = function(eci, mod, func, params,_host,_path,_root_url) { // path must start with "/"", _host must include protocol(http:// or https://)
       //.../sky/cloud/<eci>/<rid>/<name>?name0=value0&...&namen=valuen
       thisPico = eci => engine:getPicoIDByECI(eci.defaultsTo("")) == meta:picoId | false;
       blue = thisPico.klog("this ran");
       createRootUrl = function (_host,_path){
         host = _host || meta:host;
         path = _path || "/sky/cloud/";
         root_url = host+path;
         root_url
       };
       root_url = _root_url || createRootUrl(_host,_path);
       web_hook = root_url + eci + "/"+mod+"/" + func;

       response = (not thisPico) => http:get(web_hook, {}.put(params)) | QUERY_SELF_INVALID_HTTP_MAP;
       status = response{"status_code"};// pass along the status
       error_info = {
         "error": "sky query request was unsuccesful.",
         "httpStatus": {
             "code": status,
             "message": response{"status_line"}
         }
       };
       // clean up http return
       response_content = response{"content"}.decode();
       response_error = (response_content.typeof() == "Map" && (not response_content{"error"}.isnull())) => response_content{"error"} | 0;
       response_error_str = (response_content.typeof() == "Map" && (not response_content{"error_str"}.isnull())) => response_content{"error_str"} | 0;
       error = error_info.put({"skyQueryError": response_error,
                               "skyQueryErrorMsg": response_error_str,
                               "skyQueryReturnValue": response_content});
       is_bad_response = (response_content.isnull() || (response_content == "null") || response_error || response_error_str);
       // if HTTP status was OK & the response was not null and there were no errors...
       (status == 200 && not is_bad_response && not thisPico) => response_content | error
     }
     

    //returns a list of children that are contained in a given subtree at the starting child. Leafs will be listed before their parents
    gatherDescendants = function(childID){
      //moreChildren = skyQuery(child{"eci"}, "io.picolabs.wrangler", "children");
      moreChildren = engine:listChildren(childID);
      //final_pico_array = [child].append(moreChildren);

      gatherChildrensChildren = function(moreChildren){
        arrayOfChildrenArrays = moreChildren.map(function(x){ gatherDescendants(x) });
        arrayOfChildrenArrays.reduce(function(a,b){ a.append(b) });
      };

      result = (moreChildren.length() == 0) => [] | gatherChildrensChildren(moreChildren).append(moreChildren);
      result
    }

    picoFromName = function(value){
      return = children().defaultsTo([]).filter(function(child){
                                              (child{"name"} ==  value || child{"id"} == value)});
      return.head().defaultsTo("Error")//no pico exists for given name
    }

    deleteChild = defaction(pico_name){
      ent_children = children()
      child_collection = ent_children.collect(function(child){
                                              (child{"name"} ==  pico_name) => "to_delete" | "dont_delete"
                                            })
      child_to_delete = child_collection{"to_delete"}.head()

      every {
        engine:removePico(child_to_delete{"id"})
      }

      returns
      {
        "updated_children": child_collection{"dont_delete"},
        "child": child_to_delete
      }
    }

    hasChild = function(value){
      children().filter(function(child){
                          child{"name"} ==  value || child{"id"} == value
                          }).head()
    }
    
    /*
    IN: a map that can contain
        an "id" key mapped to a child Pico ID
        a "name" attribute
        a "delete_all" key mapped to a boolean value
    OUT: A map containing the picos to be deleted
        If "id" is provided the child pico with that ID will be in the map
        If "name" is provided all picos with that name will be in the map
        If "delete_all" is provided all children will be in the map
    */
    getPicosToDelete = function(deleteMap) {
      givenPicoID = deleteMap{"id"};
      nameToDelete = deleteMap{"name"};
      deleteAll = deleteMap{"delete_all"};
    
      deleteAll => 
      ent:wrangler_children |
      ent:wrangler_children.filter(function(childMap,childID){
        childMap{"name"} == nameToDelete || childMap{"id"} == givenPicoID
      });
    }
    
    getPicoMap = function() {
      {
        "name":ent:name,
        "id":ent:id,
        "parent_eci":ent:parent_eci,
        "eci":ent:eci
      }
    }
    // creates a map with a similar shape of ent:wrangler_children using engine calls.
    // Will also try and ask those children if they have wrangler installed and use that info instead if they do
    // assumes the target picos have an admin channel of type secret
    getChildMapFromIDs = function(picoIDs) {
      picoIDs.collect(function(id){id})
             .map(function(picoIDArray){
                picoID = picoIDArray[0]; // Array of 1 from collect
                grabbedChannel = engine:listChannels(picoID).reduce(function(channel_a, channel_b) {
                                                                      channel_a => channel_a |
                                                                      channel_b{"name"} == "main" && channel_b{"type"} == "wrangler" => channel_b |
                                                                      channel_b{"name"} == "admin" && channel_b{"type"} == "secret" => channel_b |
                                                                      channel_a
                                                                     }, null);
                //channelKeys = grabbedChannels.keys().klog("observed channel map keys are: ");
                grabbedEci = grabbedChannel.klog("grabbedChannel"){"id"};
                attemptedMap = skyQuery(grabbedEci.klog("eci attempt is:"), meta:rid, "getPicoMap");
                attemptedMap{"error"}.isnull() => attemptedMap.put("eci", grabbedEci) |
                                                  {
                                                    "id":picoID,
                                                    "parent_eci":"",
                                                    "name":"rogue_" + random:uuid(),
                                                    "eci": grabbedEci,
                                                    "rogue":true
                                                  }
      })
    }
    
    isMarkedForDeath = function() {
      ent:marked_for_death.defaultsTo(false)
    }
// ********************************************************************************************
// ***                                      Rulesets                                        ***
// ********************************************************************************************
    registeredRulesets = function() {
      engine:listAllEnabledRIDs()
    }

    rulesetsInfo = function(rids) {
      _rids = ( rids.typeof() == "Array" ) => rids | ( rids.typeof() == "String" ) => rids.split(";") | "" ;
      _rids.map(function(rid) {engine:describeRuleset(rid);});
    }
    
    //Given a comma-delimited array or normal array returns a normal array
     gatherGivenArray = function(attr1, attr2) {
      items = event:attr(attr1).defaultsTo(event:attr(attr2)).defaultsTo("");
      item_list = (items.typeof() ==  "Array") => items | items => items.split(re#;#) | [];
      item_list
    }

    installedRulesets = function() {
      engine:listInstalledRIDs(meta:picoId)
    }

    installRulesets = defaction(rids){
      every{
        engine:installRuleset(meta:picoId, rids) setting(new_ruleset)
      }
      returns {"rids": new_ruleset}
    }

    installRulesetByURL = defaction(url){
      every{
        engine:installRuleset(meta:picoId, url=url) setting(new_ruleset)
      }
      returns [new_ruleset]
    }

    uninstallRulesets = defaction(rids){
      every{
       engine:uninstallRuleset(meta:picoId, rids)
      }returns{}
    }
    

// ********************************************************************************************
// ***                                      Channels                                        ***
// ********************************************************************************************
    channelNameExists = function(name){
      not channel(name, null, null).isnull()
    }
    
    channelNameExistsForType = function(name, type){
      channel_array = channel(null, "type", type);
      channel_array.any(function(channel){
        channel{"name"} == name
      });
    }

    nameFromEci = function(eci){ // internal function call
      channel = channel(eci,null,null);
      channel{"name"}
    }
    eciFromName = function(name){
      channel = channel(name,null,null);
      channel{"id"}
    }

    alwaysEci = function(value){   // always return a eci wether given a eci or name
      channels = engine:listChannels(meta:picoId);
      channel = channels.filter(function(chan){chan{"id"} == value || chan{"name"} == value}).head().defaultsTo({},"no channel found in alwayseci, by .head()");
      channel{"id"}
    }

    channel = function(value,collection,filtered) {
      channels = engine:listChannels(meta:picoId);

      single_channel = function(channels){
        channel_list = channels;
        result = channel_list.filter(function(chan){chan{"id"} == value || chan{"name"} == value}).head().defaultsTo(null,"no channel found, by .head()");
        (result)
      };
      type = function(chan){ // takes a chans
        group = (chan.typeof() ==  "Map")=> // for robustness check type.
        chan{collection} | "error";
        (group)
      };
      return1 = collection.isnull() => channels |  channels.collect(function(chan){(type(chan))}) ;
      return2 = filtered.isnull() => return1 | return1{filtered};
      (value.isnull()) => return2 | single_channel(channels)
    }

    deleteChannel = defaction(value) {
        channel = channel(value,null,null)
        eci = channel{"id"}
        engine:removeChannel(eci)
        returns channel
    }

    createChannel = defaction(id , name, type, policy_id) {
      policy_present = policy_id => "T" | "F";
      choose policy_present {
        T => engine:newChannel(id , name, type, policy_id) setting(channel);
        F => engine:newChannel(id , name, type) setting(channel);
      }
      returns channel
    }

    /*
      see https://github.com/Picolab/pico-engine/pull/350#issue-160657235 for information on the format of @param new_policy and the return value
    */
    newPolicy = defaction(new_policy) {
      every{
        engine:newPolicy( new_policy ) setting(created_policy)
      }
      returns created_policy
    }

// ********************************************************************************************
// ***                                      Picos                                           ***
// ********************************************************************************************
  myself = function(){
    {
      "name":ent:name,
      "id":ent:id,
      "eci":ent:eci
    }
  }

  children = function(name) {
    _children = ent:wrangler_children.defaultsTo({});
    (name => _children.filter(function(child){child{"name"} == name}) | _children).values()
  }

  parent_eci = function() {
    ent:parent_eci.defaultsTo("")
  }

  profile = function(key) {
    /*PDS not implemented */ //pds:profile(key)
    {}
  }
  pico = function() {
    profile_return = {};/*PDS not implemented */ //pds:profile();
    settings_return = {};/*PDS not implemented */ //pds:settings();
    general_return = {};/*PDS not implemented */ //pds:items();
    {
      "profile" : profile_return{"profile"},
      "settings" : settings_return{"settings"},
      "general" : general_return{"general"}
    }
  }

  name = function() {
    ent:name
  }

  id = function() {
    meta:picoId
  }

  picoECIFromName = function (name) {
    pico = ent:wrangler_children.filter(function(rec){rec{"name"} ==  name})
                          .head();
    pico{"eci"}
  }

  createPico = defaction(name, rids, rids_from_url){
    every{
      engine:newChannel(meta:picoId, name, "children") setting(parent_channel);// new eci for parent to child
      engine:newPico() setting(child);// newpico
      engine:newChannel(child{"id"}, "main", "wrangler"/*"secret"*/) setting(channel);// new child root eci
      engine:installRuleset(child{"id"},config{"os_rids"});// install child OS
      event:send( // introduce child to itself and parent
        { "eci": channel{"id"},
          "domain": "wrangler", 
          "type": "child_created",
          "attrs": 
              event:attrs.put(({
              "parent_eci": parent_channel{"id"},
              "name": name,
              "id" : child{"id"},
              "eci": channel{"id"},
              "rids_to_install": rids.defaultsTo([]).append(config{"connection_rids"}),
              "rids_from_url": rids_from_url.defaultsTo([])
          }))
        });
    }
    returns {
     "parent_eci": parent_channel{"id"},
     "name": name,
     "id" : child{"id"},
     "eci": channel{"id"}
    }
  }
/*
    updateChildCompletion = function(name){
      children_map = ent:wrangler_children.collect(function(child){
                                            (child.name == name) => "childToUpdate" | "otherChildren"
                                          });//separate the children, returns two arrays


      updated_child = children_map{"childToUpdate"}.head();
      updated_children = children_map{"otherChildren"}.append(updated_child);//reunite with the other children
      updated_children
    }
*/
    // optimize by taking a list of names, to prevent multiple network calls to channels when checking for unique name
    MAX_RAND_ENGL_NAMES = 200
    
    randomPicoName = function(){
        w_children = children();
        generateName = function() {
          word = random:word();
          w_children.none(function(child){child{"name"} == word}) => word | generateName()
        };
        
        w_children.length() > MAX_RAND_ENGL_NAMES => random:uuid() | generateName()
    }
    

  }
// ********************************************************************************************
// ***                                                                                      ***
// ***                                      System                                          ***
// ***                                                                                      ***
// ********************************************************************************************
  rule systemOnLine {
    select when system online
    foreach children() setting(child)
      event:send({ "eci"   : child{"eci"},
                   "domain": "system", "type": "online",
                   "attrs" : event:attrs })  
    }
// ********************************************************************************************
// ***                                                                                      ***
// ***                                      Rulesets                                        ***
// ***                                                                                      ***
// ********************************************************************************************

  
  rule installURLRulesets {
    select when wrangler install_rulesets_requested
    foreach gatherGivenArray("urls","url") setting(url)
    pre{
      url1 = url.klog("URL: ")
    }
    every {
      installRulesetByURL(url) setting(rids)
      send_directive("rulesets installed", { "rids": rids });
    }
    fired{
      raise wrangler event "ruleset_added" 
        attributes event:attrs.put("rids", rids);
    }
  }
  
    rule installRulesets {
    select when wrangler install_rulesets_requested
    pre {
      rid_list = gatherGivenArray("rids", "rid").klog("given array is: ")
      valid_rids = rid_list.intersection(registeredRulesets())
      invalid_rids = rid_list.difference(valid_rids)
      initial_install = event:attr("init").defaultsTo(false) // if this is a new pico
    }
    if(rids !=  "") && valid_rids.length() > 0 then every{
      installRulesets(valid_rids) setting(rids)
      send_directive("rulesets installed", { "rids": rids{"rids"} });
    }
    fired {
      raise wrangler event "ruleset_added"
        attributes event:attrs.put(["rids"], rids{"rids"})
    }
    finally {
      raise wrangler event "install_rulesets_error"
        attributes event:attrs.put(["rids"],invalid_rids) if invalid_rids.length() > 0;
      raise wrangler event "finish_initialization"
        attributes event:attrs  if initial_install == true;
    }
  }

  rule uninstallRulesets {
    select when wrangler uninstall_rulesets_requested
    pre {
      rid_list = gatherGivenArray("rids", "rid")
    } every{
      uninstallRulesets(rid_list)
      send_directive("rulesets uninstalled", {"rids":rid_list});
    }
  }

// ********************************************************************************************
// ***                                      Channels                                        ***
// ********************************************************************************************

  rule createChannel {
    select when wrangler channel_creation_requested
    pre { 
      channel_name = event:attr("name") 
      channel_type = event:attr("type").defaultsTo("_wrangler")
    }
    if(not channelNameExistsForType(channel_name, channel_type) && not channel_name.isnull() ) then every {
      createChannel(meta:picoId,
                    channel_name,
                    channel_type,
                    event:attr("policy_id")) setting(channel);
      send_directive("channel_Created", channel);
    }
    fired {
      raise wrangler event "channel_created" // API event
            attributes event:attrs.put(["channel"], channel);
    } else {
      error info <<could not create channel #{channel_name}.>>
    }
  }

  rule deleteChannel {
    select when wrangler channel_deletion_requested
    pre {

    }
    every {
      deleteChannel( alwaysEci(event:attr("eci")
                     .defaultsTo(event:attr("name")
                     .defaultsTo("")))) setting(channel);
      send_directive("channel_deleted", channel);
    }
    always {
     raise wrangler event "channel_deleted" // API event
           attributes event:attrs.put(["channel"],channel)
         }
    }


// ********************************************************************************************
// ***                                      Picos                                           ***
// ********************************************************************************************
  //-------------------- Picos initializing  ----------------------
  rule createChild {
    select when wrangler child_creation or wrangler new_child_request
    pre {
      given_name = event:attr("name").defaultsTo("");
      name = given_name.length() == 0 => randomPicoName() | given_name;
      rids = gatherGivenArray("rids","rid")
      url_rids = gatherGivenArray("rids_from_url").klog("url rids are:")

    }
    // If we have a name and this pico isn't currently trying to destroy itself
    if (name) && not (isMarkedForDeath()) then every {
      createPico(name, rids, url_rids) setting(child)
      send_directive("Pico_Created", {"pico":child});
    }
    fired {
      //ent:wrangler_children := {} if ent:wrangler_children.isnull(); // this is bypassed when module is used
      //ent:wrangler_children{child{"id"}} := child; // this is bypassed when module is used
    }
    else{
      raise wrangler event "child_creation_failure"
        attributes event:attrs
    }
  }

  rule createChild_failure {
    select when wrangler child_creation_failure
      send_directive("Pico_Not_Created", {});
    always {
      error info <<Failed to create pico>>;
    }
  }

  rule initialize_child_after_creation {
    select when wrangler child_created
    pre {
      rids_to_install = event:attr("rids_to_install")
      rids_to_install_from_url = event:attr("rids_from_url")
    }
    if rids_to_install.length() > 0 then
    noop()
    fired {
      raise wrangler event "install_rulesets_requested"
        attributes event:attrs.put("init", true)
                              .put(["rids"], rids_to_install)
                              .put(["urls"], rids_to_install_from_url)
    }
    else {
      raise wrangler event "finish_initialization"
        attributes event:attrs
    }
    finally {
      ent:parent_eci := event:attr("parent_eci");
      ent:name := event:attr("name");
      ent:id := event:attr("id");
      ent:eci := event:attr("eci");
    }
  }

  rule finish_child_initialization {
    select when wrangler finish_initialization
      event:send({ "eci"   : event:attr("parent_eci"),
                   "domain": "wrangler", "type": "child_initialized",
                   "attrs" : event:attrs })
    always {
      raise visual event "update"
        attributes event:attr("rs_attrs").defaultsTo({}).put("dname",event:attr("name"))
    }
  }
  
  // this pico is the primary pico

  rule pico_root_created {
    select when wrangler root_created
    always {
      ent:id := meta:picoId;
      ent:eci := event:attr("eci");
      ent:wrangler_children := {};
      //ent:children := {};
      ent:name := "Root Pico"
    }
  }
    
    
  
  //-------------------- PARENT PERSPECTIVE  ----------------------
  rule deleteChild {
    select when wrangler child_deletion or wrangler delete_children
    pre {
      picoIDMap = getPicosToDelete(event:attrs).klog("Found these picos to delete: ");
      picoIDArray = picoIDMap.keys();
    }
    always {
      ent:children_being_deleted := ent:children_being_deleted.defaultsTo({}).put(picoIDMap).klog("Children being deleted is now: ");
      raise wrangler event "send_intent_to_delete" attributes event:attrs.put({
        "picoIDArray":picoIDArray
      });
    }
  }
  
  rule send_intent_to_delete {
    select when wrangler send_intent_to_delete
    foreach event:attr("picoIDArray") setting (picoID)
    pre {
      e = ent:wrangler_children.klog("wrangler children is: ")
      picoEci = ent:wrangler_children{[picoID.klog("target picoID"), "eci"]};
      attrsToSend = event:attrs.delete("picoIDArray")
  
    }
    event:send({"eci":picoEci.klog("target eci"), "domain":"wrangler", "type":"intent_to_delete_pico", "attrs":attrsToSend});
    always {
      clear ent:wrangler_children{picoID}
    }
  }
  
  rule delete_child {
    select when wrangler child_ready_for_deletion
    pre {
      picoID = event:attr("id");
    }
    every{
      engine:removePico(event:attr("id"))
      deleteChannel(event:attr("parent_eci"))
    }
    always{
      clear ent:children_being_deleted{picoID};
      raise wrangler event "child_deleted"
        attributes event:attrs;
    }
  }
  
  // Sync with children that may not have been created or deleted by wrangler.
  // Assumes all picos have a channel of type "admin" with a policy that will allow all events from a parent ruleset
  // If the child does not have wrangler installed, any wrangler event chains requiring child cooperation will not work
  rule syncChildren {
    select when wrangler child_sync
    pre {
      // Children that wrangler knows about
      wranglerChildren = ent:wrangler_children.keys();
      engineChildren = engine:listChildren();
      
      //Children that exist but wrangler doesn't know about
      ghostChildren = engineChildren.difference(wranglerChildren);
      
      ghostChildrenMap = getChildMapFromIDs(ghostChildren).klog("ghost children map is");
      
      //Children that don't exist but wrangler still has record of
      extraChildren = wranglerChildren.difference(engineChildren)
    }
    always {
      ent:wrangler_children := ent:wrangler_children.filter(function(v,picoID){
         not (picoID >< extraChildren)
      });
      ent:wrangler_children := ent:wrangler_children.put(ghostChildrenMap); // Possible to do root-level map merge?
    }
  }
  
  rule forceChildrenDeletion {
    select when wrangler force_child_deletion or wrangler force_children_deletion
    pre {
      // TODO: get ID or whole map from engine calls instead of ent:wrangler_children
      picoIDArray = getPicosToDelete(event:attrs).keys();
      picoSubtreeArrays = picoIDArray.map(function(picoID) {
        gatherDescendants(picoID)
      }).klog("picoSubtreeArrays")
      flatArray = picoSubtreeArrays.reduce(function(id_array_a, id_array_b){
                                            id_array_a.append(id_array_b);
                                          }, []).append(picoIDArray).klog("full flat array")
    }
    always {
      raise wrangler event "picos_to_force_delete_ready" attributes event:attrs
                                                                    .put("picoIDArray", flatArray)
    }
  }
    
    rule delete_each_pico_id {
      select when wrangler picos_to_force_delete_ready
      foreach event:attr("picoIDArray") setting (picoID)
      
      engine:removePico(picoID)
      
      always {
        clear ent:wrangler_children{picoID};
        clear ent:children_being_deleted{picoID}; // if was already trying to be deleted through wrangler
        raise wrangler event "pico_forcibly_removed" attributes event:attrs
                                                                   .delete("picoIDArray")
                                                                   .put("id", picoID)
      }
    }
  
    //-------------------- CHILD PERSPECTIVE  ----------------------
    
  rule parent_requested_deletion {
    select when wrangler intent_to_delete_pico
    always {
      ent:marked_for_death := true;
      raise wrangler event "delete_children" attributes event:attrs
                                                        .put("delete_all", true);
      raise wrangler event "rulesets_need_to_cleanup" attributes event:attrs;
    }  
  }
  
  rule registerForCleanup {
    select when wrangler ruleset_needs_cleanup_period
    pre {
      domain = event:attr("domain")
    }
    if domain && not ent:marked_for_death then
    noop()
    fired {
      ent:registered_for_cleanup := ent:registered_for_cleanup.defaultsTo([]).append(domain);
    }
    else {
      raise wrangler event "cleanup_domain_registration_failure" attributes event:attrs.put(
        "error","Failed to register domain for cleanup guarantee"
      )
    }
  }
  
  
  rule cleanupFinished {
    select when wrangler cleanup_finished
    pre {
      domain = event:attr("domain")
    }
    always {
      ent:registered_for_cleanup := ent:registered_for_cleanup.filter(function(registeredDomain) {
        registeredDomain != domain
      });
    }
  }
    
  rule is_pico_ready_to_delete {
    select when wrangler intent_to_delete_pico or
                wrangler cleanup_finished or
                wrangler child_ready_for_deletion or
                wrangler delete_this_pico_if_ready
    pre {
      ready_to_delete = ent:marked_for_death
                        &&  ent:children_being_deleted.defaultsTo([]).length() == 0
                        &&  ent:registered_for_cleanup.defaultsTo([]).length() == 0;
    }
    if ready_to_delete then
      event:send({"eci":parent_eci(), "domain":"wrangler", "type":"child_ready_for_deletion", "attrs":event:attrs
                                                                                                      .put(getPicoMap())
      })
  }
  
  //-------------------- Pico Misc  ----------------------
  
  rule inform_parent_of_child_data {
    select when wrangler inform_parent_of_pico_data
    event:send({"eci":parent_eci(), "domain":"wrangler", "type":"child_ready_for_deletion", "attrs":event:attrs
                                                                                                      .put(getPicoMap())
      })
  }
  
  
  
    


}//end ruleset