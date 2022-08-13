import { Construct } from 'constructs'
import { Aws, Duration } from 'aws-cdk-lib'
import { Key } from 'aws-cdk-lib/aws-kms'
import { BlockPublicAccess, Bucket, BucketEncryption, BucketProps } from 'aws-cdk-lib/aws-s3'
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs'
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'

export interface MessageConstructProps {
    /**
     * 
     */
    environment: string,
    /**
     * 
     */
    appName: string,
    /**
     * 
     */
    processingLambda: NodejsFunction
}

/**
 * 
 */
export class CustomMessageConstruct extends Construct {
    constructor ( scope: Construct, id: string, props: MessageConstructProps ) {
        super( scope, id )

        // Create the CMK used to encrypt all resources this deploys
        const cmk = new Key( this, 'KmsCmk', {
            alias: `${props.appName}MessageQueueCmk`,
            enabled: true,
            enableKeyRotation: true,
            pendingWindow: Duration.days( 7 ),
            description: 'KMS CMK used for message queue test'
        } )


        // Setup default config shared by the SQS Queues
        const defaultQueueConfig: Partial<QueueProps> = {
            encryption: QueueEncryption.KMS,
            encryptionMasterKey: cmk,
        }


        // Create both the DL and processing message queues
        const dlQueue = new Queue( this, 'DLQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}DLQueue${props.environment}`,
            retentionPeriod: Duration.seconds( 21600 )
        } )

        const messageQueue = new Queue( this, 'MessageQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}MessageQueue${props.environment}`,
            deadLetterQueue: {
                queue: dlQueue,
                maxReceiveCount: 3
            },
            // Set visibility timeout to the timeout of the processing function + 30 seconds
            visibilityTimeout: props.processingLambda.timeout!.plus( Duration.seconds( 30 ) )
        } )

        props.processingLambda.addEventSource( new SqsEventSource( messageQueue, {
            batchSize: 1
        } ) )


        // Setup the default S3 config used by both Buckets
        const defaultBucketConfig: Partial<BucketProps> = {
            encryption: BucketEncryption.KMS,
            encryptionKey: cmk,
            bucketKeyEnabled: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        }

        // The Bucket names are lower cased to ensure whatever is passed will be allowed for S3 naming standards
        const deliveryBucket = new Bucket( this, 'DeliveryBucket', {
            ...defaultBucketConfig,
            bucketName: ( `${props.appName}-delivery-bucket-${props.environment}-${Aws.ACCOUNT_ID}` ).toLowerCase()
        } )

        // Send messages to SQS when an object is created in the S3 Bucket
        deliveryBucket.addObjectCreatedNotification(
            new SqsDestination( messageQueue )
        )

        // Granting permissions to the Processing Lambda IAM Role
        deliveryBucket.grantRead( props.processingLambda.role! )
        cmk.grantEncryptDecrypt( props.processingLambda.role! )
        messageQueue.grantConsumeMessages( props.processingLambda.role! )

        const failureBucket = new Bucket( this, 'FailureBucket', {
            ...defaultBucketConfig,
            bucketName: ( `${props.appName}-failed-delivery-bucket-${props.environment}-${Aws.ACCOUNT_ID}` ).toLowerCase(),
        } )


        const failureLambda = new NodejsFunction( this, 'failureLambda', {
            entry: './src/lambda/failedDelivery.ts',
            handler: 'handler',
            runtime: Runtime.NODEJS_16_X,
            memorySize: 128,
            bundling: {
                sourceMap: true
            },
            functionName: `${props.appName}FailureLambda`,
            description: 'Polls the failed queue to put S3 Objects into the failed Bucket for follow-up',
            environment: {
                DL_QUEUE_URL: dlQueue.queueUrl,
                FAILURE_BUCKET: failureBucket.bucketName,
                DEBUG_LOGS: 'true',
                DELIVERY_BUCKET: deliveryBucket.bucketName,
                REGION: Aws.REGION
            }

        } )

        deliveryBucket.grantRead( failureLambda.role! )
        failureBucket.grantReadWrite( failureLambda.role! )
        cmk.grantEncryptDecrypt( failureLambda.role! )
        dlQueue.grantConsumeMessages( failureLambda.role! )

        // Creates an Event Rule that triggers hourly to pull messages from the failure queue
        const failureEventRule = new Rule( this, 'FailureLambdaTrigger', {
            ruleName: `${props.appName}FailureTrigger`,
            description: 'Triggers the failure lambda hourly to get messages from the failure queue',
            schedule: Schedule.rate( Duration.hours( 1 ) )
        } )

        failureEventRule.addTarget( new LambdaFunction( failureLambda ) )

        // Adding a new Environment Variable for the Processing Lambda
        props.processingLambda.addEnvironment( 'DELIVERY_BUCKET', deliveryBucket.bucketName )







    }
}