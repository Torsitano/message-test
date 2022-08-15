# Claim Check Serverless Object Processing Construct - CDKTF

This is a demo repo for a serverless deployment for processing S3 Objects based on the [Claim Check](https://aws.plainenglish.io/an-introduction-to-claim-check-pattern-and-its-uses-b018649a380d) pattern.

The `MessageConstruct.ts` file in `lib/constructs` provides the deployment in a modular fashion, and is deployed through the `MessageStack.ts` cdk file.

## Components

The following resources are created by the custom construct:

- **Delivery Bucket** - An S3 Bucket that new objects are uploaded to for processing
- **Message Queue** - An SQS Queue that receives the upload events from the Delivery Bucket
  - A standard SQS Queue is used, so the processing logic needs to handle the potential for duplicate and/or out of order messages
- **Processing Lambda** - Triggered by messages in the Message Queue
- **DL Queue** - Receives messages from the Message Queue that fail to be processed by the Processing Lambda
- **Failure Lambda** - Polls the DL Queue on a schedule for messages to handle objects that could not be processed
- **Failure Bucket** - Holds objects that could not be processed for follow-up
- **KMS CMKs** - Used to encrypt data in S3 and SQS

## Workflow

The primary purpose of this design is to process new objects uploaded to an S3 Bucket. When an object is uploaded, a message is sent to the Message Queue with information about the S3 object.

The Message Queue triggers the Processing Lambda, which will attempt to process the object.

If the Processing Lambda fails 3 times, the Message Queue sends the message over to the DL Queue. The Failure Lambda runs on a scheduled basis as a cleanup function, and will check the DL Queue for messages. If it finds any, it copies the object to the Failure Bucket, deletes the object from the Delivery Bucket, and deletes the message from the DL Queue.

## Using the Custom Construct

This is designed so the `CustomMessageConstruct` can be dropped into another application for use with minimal work. It's instantiated inside of a CDK Stack like other constructs, and requires a few parameters:

```typescript
new CustomMessageConstruct( this, 'MessageDeployment', {
    environment: 'Prod',
    appName: 'MessageTestTf',
    processingLambdaCode: './dist/processMessage/',
    awsAccountId: '123456789123',
    lambdaOverrides: {
        memorySize: 256,
        timeout: 60
    }
} )
```

The `processingLambdaCode` is the TypeScript file containing the code for how objects should be processed. `lambdaOverrides` is optional, and allows changes to parameters as required for different processing times or memory requirements.

# Deployment

This is deployed using AWS CDKTF. 

The Lambda code is transpiled using `esbuild` and zipped/uploaded using Terraform. If you make a change to the Lambda code, you must run the following command to transpile the code before running the CDKTF deploy:

```shell
npm run build:lambdas
```

Configure your parameters in the `MessageStack.ts` file, ensure you have valid/active credentials, and run the following command to deploy the stack:

```shell

cdktf deploy MessageStackCdkTf
```

# Testing

Testing is done with Jest. To execute the test suite, run:

```shell
npm run test
```