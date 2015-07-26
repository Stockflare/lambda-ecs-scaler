// event = {
//     "AlarmName": "test-alarm",
//     "AlarmDescription": "eydzZXJ2aWNlJzonYXJuOmF3czplY3M6dXMtZWFzdC0xOjMxODc0MTU3NzU5ODpzZXJ2aWNlL3NlcnZpLVNlcnZpLTE1NklJVUNGNjFNWUMnLCdjbHVzdGVyJzonY29yZW8tRUNTQ2wtMU5TU0hMQlZNMTVZWid9",
//     "AWSAccountId": "318741577598",
//     "NewStateValue": "OK",
//     "NewStateReason": "Threshold Crossed: 1 datapoint (1.0) was greater than or equal to the threshold (0.0).",
//     "StateChangeTime": "2015-07-17T15:18:01.441+0000",
//     "Region": "US - N. Virginia",
//     "OldStateValue": "ALARM",
//     "Trigger": {
//         "MetricName": "RequestCount",
//         "Namespace": "AWS/ELB",
//         "Statistic": "AVERAGE",
//         "Unit": null,
//         "Dimensions": [
//             {
//                 "name": "LoadBalancerName",
//                 "value": "service-ElasticLoa-DHXVMAJPOW55"
//             }
//         ],
//         "Period": 300,
//         "EvaluationPeriods": 1,
//         "ComparisonOperator": "GreaterThanOrEqualToThreshold",
//         "Threshold": 0
//     }
// }
exports.handler = function (event, context) {

  var aws = require('aws-sdk');

  try {
    var newState = event.NewStateValue;
    var oldState = event.OldStateValue;
    var direction = determineDirection(oldState, newState);

    console.log("here...");

    if(newState != oldState && direction !== 0) {

      var ecs = decode(event.AlarmDescription);
      var region = regionToCode(event.Region);

      console.log("here...");

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
          if(att.desired > att.outcome > 0 || att.pending === 0) {
            console.log("adjusting from " + att.desired + " to " + att.outcome);
            var params = {
              service: ecs.service,
              cluster: ecs.cluster,
              desiredCount: att.outcome
            }
            cluster.updateService(params, function(err, data) {
              if (err) {
                console.log(err, err.stack);
                throw err.stack;
              } else {
                console.log(data);
                context.succeed();
              }
            });
          } else {
            var reason = JSON.stringify(att);
            context.succeed({ message: 'no action: [' + reason + ']' });
          }
        }
      });

    } else {
      context.succeed({ message: 'no action necessary: [' + oldState + '] => [' + newState + ']' });
    }
  } catch(e) {
    context.fail(e);
  }

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
          return 0;
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
