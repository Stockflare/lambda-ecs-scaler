var _ = require('underscore');
var when = require('when');
var aws = require('aws-sdk');

exports.handler = function (event, context) {
  console.log('Event');
  console.log(event);
  var records = event.Records;
  console.log('Records');
  console.log(records);

  var actions = _.map(records, function(record, index, all_records){
    return when.promise(function(resolve, reject, notify){
      console.log('record');
      console.log(record);

      var message_json = record.Sns.Message;
      console.log('message_json');
      console.log(message_json);
      var message = JSON.parse(message_json);
      console.log('message');
      console.log(message);

      try {
        var newState = message.NewStateValue;
        var oldState = message.OldStateValue;
        var direction = determineDirection(oldState, newState);

        if(newState != oldState && direction !== 0) {
          console.log('Attempting Scaling');

          var ecs = decode(message.AlarmDescription);
          console.log('ecs');
          console.log(ecs);
          var region = regionToCode(message.Region);
          console.log('region');
          console.log(region);


          if( ! ecs.service || ! ecs.cluster) throw "expecting (JSON) { 'service': '...', 'cluster': '...' }";

          console.log("alarm triggered for " + ecs.service + " in region " + region);

          var cluster = new aws.ECS({ region: region });

          cluster.describeServices({ cluster: ecs.cluster, services: [ ecs.service ] }, function(err, data) {
            if (err) {
              console.log(err, err.stack);
              throw err.stack;
            } else {
              var att = {
                desired: data.services[0].desiredCount,
                running: data.services[0].runningCount,
                pending: data.services[0].pendingCount,
                outcome: data.services[0].desiredCount + direction
              };
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
          return 0;
        case "INSUFFICIENT_DATA":
          return -1;
      }
      break;
    case "OK":
      switch(newState) {
        case "ALARM":
          return 1;
        case "INSUFFICIENT_DATA":
          return -1;
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
