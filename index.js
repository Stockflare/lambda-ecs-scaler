var _ = require('underscore');
var when = require('when');
var aws = require('aws-sdk');
var min_instaces = 3;

exports.handler = function (event, context) {
  var records = event.Records;

  var actions = _.map(records, function(record, index, all_records){
    return when.promise(function(resolve, reject, notify){

      var message_json = record.Sns.Message;
      var message = JSON.parse(message_json);

      try {
        var newState = message.NewStateValue;
        var oldState = message.OldStateValue;
        var direction = determineDirection(oldState, newState);

        if(newState != oldState && direction !== 0) {

          var ecs = decode(message.AlarmDescription);
          var region = regionToCode(message.Region);


          if( ! ecs.service || ! ecs.cluster) throw "expecting (JSON) { 'service': '...', 'cluster': '...' }";

          console.log("alarm triggered for " + ecs.service + " in region " + region);

          var cluster = new aws.ECS({ region: region });

          cluster.describeServices({ cluster: ecs.cluster, services: [ ecs.service ] }, function(err, data) {
            if (err) {
              console.log(err, err.stack);
              throw err.stack;
            } else {

              var scaling_adjustment = 1;
              if (!_.isUndefined(ecs.scaling_adjustment)) {
                scaling_adjustment = parseInt(ecs.scaling_adjustment);
              }



              var att = {
                desired: data.services[0].desiredCount,
                running: data.services[0].runningCount,
                pending: data.services[0].pendingCount,
                outcome: data.services[0].desiredCount + (direction * parseInt(scaling_adjustment))
              };

              if (att.outcome < min_instaces) {
                att.outcome = min_instaces;
              }

              if(att.desired !== att.outcome && att.outcome > 0) {
                console.log("adjusting from " + att.desired + " to " + att.outcome);
                var params = {
                  service: ecs.service,
                  cluster: ecs.cluster,
                  desiredCount: att.outcome
                };
                cluster.updateService(params, function(err, data) {
                  if (err) {
                    console.log(err, err.stack);
                    throw err.stack;
                  } else {
                    console.log(data);
                    resolve({message: "adjusting from " + att.desired + " to " + att.outcome});
                  }
                });
              } else {
                var reason = JSON.stringify(att);
                resolve({ message: 'no action: [' + reason + ']' });
              }
            }
          });

        } else {
          resolve({ message: 'no action necessary: [' + oldState + '] => [' + newState + ']' });
        }
      } catch(e) {
        console.log("ERROR processing message", e);
        reject(e);
      }
    });
  });

  when.all(actions).done(function(records){
    context.succeed("Successfully processed " + records.length + " records.");
  }, function(reason){
    context.fail("Failed to process records " + reason);
  });


};

var determineDirection = function(oldState, newState) {
  switch(oldState) {
    case "INSUFFICIENT_DATA":
      switch(newState) {
        case "ALARM":
          return 1;
        case "OK":
          return 0;
      }
      break;
    case "ALARM":
      switch(newState) {
        case "OK":
          return -1;
        case "INSUFFICIENT_DATA":
          return -1;
      }
      break;
    case "OK":
      switch(newState) {
        case "ALARM":
          return 1;
        case "INSUFFICIENT_DATA":
          return 0;
      }
      break;
  }
};

var regionToCode = function(region) {
  switch(region) {
    case "US - N. Virginia":
      return "us-east-1";
    default:
      throw "unable to determine region code: " + region;
  }
};

var decode = function(base64) {
  try {
    return JSON.parse(new Buffer(base64, 'base64'));
  } catch(e) {
    throw "error decoding (base64) alarm description to discover ECS information (" + e + ")";
  }
};
