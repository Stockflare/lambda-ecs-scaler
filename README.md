# ECS Scaler

| Staging | Production |
|:-:|:-:|
|[![Build Status](http://drone.stocktio.com/api/badge/github.com/Stockflare/lambda-ecs-scaler/status.svg?branch=master)](http://drone.stocktio.com/github.com/Stockflare/lambda-ecs-scaler)| --- |

This lambda function manages the scaling of Elastic Container Services (AWS ECS) based upon Cloudwatch Alarm triggers. The function is designed to parse the alarms description (bit hacky, I know..) to determine which Cluster and Service to scale.

Stockflare uses this function internally via our Cloudformations, to automate our alarms and the scaling of our own services based upon the load that they are currently receiving. We find it very reactive and most importantly, fast.

### Alarm States and Count changes

| Old State         | New State         | Desired Count |
|-------------------|-------------------|---------------|
| ALARM             | OK                | -1            |
| OK                | ALARM             | 1             |
| ALARM             | ALARM             | 0             |
| OK                | OK                | 0             |
| ALARM             | INSUFFICIENT_DATA | 0             |
| OK                | INSUFFICIENT_DATA | 0             |
| INSUFFICIENT_DATA | INSUFFICIENT_DATA | 0             |
| INSUFFICIENT_DATA | ALARM             | +1            |
| INSUFFICIENT_DATA | OK                | 0             |

---

### Usage in Cloudformations

Here is an example of how we build Cloudwatch Alarms that trigger this function within our own Cloudformations:

```
{
  ...

  "RequestCountHigh": {
    "Type": "AWS::CloudWatch::Alarm",
    "Properties" : {
      "AlarmDescription": { "Fn::Base64": { "Fn::Join" : ["", [
        "{",
          "\"service\":\"", { "Ref" : "Service" }, "\",",
          "\"cluster\":\"", { "Ref" : "ECSCluster" }, "\"",
        "}"
      ]]}},
      "MetricName": "RequestCount",
      "Namespace": "AWS/ELB",
      "Statistic": "Sum",
      "Period": "300",
      "EvaluationPeriods": "1",
      "ComparisonOperator": "GreaterThanThreshold",
      "Threshold": "1337",
      "AlarmActions": [{ "Ref" : "ScalingTopic" }],
      "OKActions" : [{ "Ref" : "ScalingTopic" }],
      "InsufficientDataActions" : [{ "Ref" : "ScalingTopic" }],
      "Dimensions": [{
        "Name": "LoadBalancerName",
        "Value": { "Ref": "ElasticLoadBalancer" }
      }]
    }
  }

  ...
}
```

Note that the AlarmDescription encodes using base64, a JSON Object containing the Service and Cluster name to scale.

---

### Adding the function itself as a Resource

Below is an example of how you can include this Lambda function as an AWS Resource in one of your own templates.

Firstly, you will need an IAM Role for the function that matches the following permissions:

```
{
  "PolicyName": "root",
  "PolicyDocument": {
    "Version" : "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:*:*:*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "ecs:Describe*",
          "ecs:Update*"
        ],
        "Resource": [
          "*"
        ]
      }
    ]
  }
}
```

Once that's done, you can then add the function as a resource using something similar to the following declaration:

```
{
  ...

  "LambdaScalerFunction": {
    "Type" : "AWS::Lambda::Function",
    "Properties" : {
      "Description" : "Scales ECS Containers in response to Cloudwatch Alarms",
      "Runtime" : "nodejs",
      "MemorySize" : "128",
      "Timeout" : "3",
      "Handler" : "index.handler",
      "Role" : { "Ref" : "LambdaScalerIAMRoleArn" },
      "Code" : {
        "S3Bucket" : "cfn-ecs-scaler",
        "S3Key" : "ECSScaler.zip"
      }
    }
  },

  "ScalingTopic" : {
    "Type" : "AWS::SNS::Topic",
    "Properties" : {
      "Subscription" : [{
        "Endpoint" : { "Fn::GetAtt" : ["LambdaScalerFunction", "Arn"] },
        "Protocol" : "lambda"
      }]
    }
  }

  ...
}
```

You're set, the `S3Bucket` that the resource uses is located in `us-east-1`. If that's your region then your set, else you'll need to either clone this repo and deploy the code yourself, or copy the ZIP file located within that bucket.

---

#### Deploying directly to Lambda

0. Fork and/or Clone this repo to any location you like.
0. Install the project's dependencies with `npm install`.
0. Run `grunt deploy` with the following arguments:
  * `--arn` the `arn:bla:bla:bla` location of your lambda function
  * `--profile` the AWS CLI configuration profile you wish to use

---

*If you have any questions or feedback, feel free to get in touch via Gitter, or open an Issue.*
