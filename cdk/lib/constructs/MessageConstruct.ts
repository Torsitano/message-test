import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import { Key } from 'aws-cdk-lib/aws-kms'
import { BlockPublicAccess, Bucket, BucketEncryption, BucketProps } from 'aws-cdk-lib/aws-s3'
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs'
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
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
    processingLambdaCode: string,
    /**
     * 
     */
    awsAccountId: string
}

/**
 * 
 */
export class CustomMessageConstruct extends Construct {
    constructor ( scope: Construct, id: string, props: MessageConstructProps ) {
        super( scope, id )


        // Create the CMK used to encrypt all resources this deploys
        const s3Cmk = new Key( this, 'S3Cmk', {
            alias: `${props.appName}S3Cmk`,
            enabled: true,
            enableKeyRotation: true,
            pendingWindow: Duration.days( 7 ),
            description: 'KMS CMK used for message queue test'
        } )

        const sqsCmk = new Key( this, 'SqsCmk', {
            alias: `${props.appName}SqsCmk`,
            enabled: true,
            enableKeyRotation: true,
            pendingWindow: Duration.days( 7 ),
            description: 'KMS CMK used for message queue test'
        } )


        // Setup default config shared by the SQS Queues
        const defaultQueueConfig: Partial<QueueProps> = {
            encryption: QueueEncryption.KMS,
            encryptionMasterKey: sqsCmk,
        }


        // Create both the DL and processing message queues
        const dlQueue = new Queue( this, 'DLQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}DLQueue${props.environment}`,
            retentionPeriod: Duration.seconds( 21600 )
        } )

        //@ts-ignore
        const messageQueue = new Queue( this, 'MessageQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}MessageQueue${props.environment}`,
            deadLetterQueue: {
                queue: dlQueue,
                maxReceiveCount: 3
            },
            // Set visibility timeout to the timeout of the processing function + 30 seconds
            visibilityTimeout: Duration.seconds( 30 ) //props.processingLambda.timeout!.plus( Duration.seconds( 30 ) )
        } )


        // Setup the default S3 config used by both Buckets
        const defaultBucketConfig: Partial<BucketProps> = {
            encryption: BucketEncryption.KMS,
            encryptionKey: s3Cmk,
            bucketKeyEnabled: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        }

        // The Bucket names are lower cased to ensure whatever is passed will be allowed for S3 naming standards
        const deliveryBucket = new Bucket( this, 'DeliveryBucket', {
            ...defaultBucketConfig,
            bucketName: ( `${props.appName}-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase()
        } )

        // Send messages to SQS when an object is created in the S3 Bucket
        deliveryBucket.addObjectCreatedNotification(
            new SqsDestination( messageQueue )
        )



        const failureBucket = new Bucket( this, 'FailureBucket', {
            ...defaultBucketConfig,
            bucketName: ( `${props.appName}-failed-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase(),
        } )


        const lambdaDefaults: NodejsFunctionProps = {
            handler: 'handler',
            runtime: Runtime.NODEJS_16_X,
            memorySize: 128,
            bundling: {
                sourceMap: true
            },
            timeout: Duration.seconds( 30 )
        }

        // Increase memory and timeout as required for process
        const processingLambda = new NodejsFunction( this, 'processingLambda', {
            ...lambdaDefaults,
            entry: props.processingLambdaCode,
            functionName: `${props.appName}-processing-lambda`,
            description: 'Processes objects put into the S3 Bucket for inbound payloads',
            environment: {
                DEBUG_LOGS: 'true',
                FAILURE_TEST: 'true',
                DELIVERY_BUCKET: deliveryBucket.bucketName
            }
        } )

        processingLambda.addEventSource( new SqsEventSource( messageQueue, {
            batchSize: 1
        } ) )

        // Granting permissions to the Processing Lambda IAM Role
        deliveryBucket.grantRead( processingLambda.role! )
        s3Cmk.grantEncryptDecrypt( processingLambda.role! )
        sqsCmk.grantEncryptDecrypt( processingLambda.role! )
        messageQueue.grantConsumeMessages( processingLambda.role! )

        const failureLambda = new NodejsFunction( this, 'failureLambda', {
            ...lambdaDefaults,
            entry: './src/lambda/failedDelivery.ts',
            functionName: `${props.appName}-failure-lambda`,
            description: 'Polls the failed queue to put S3 Objects into the failed Bucket for follow-up',
            environment: {
                DL_QUEUE_URL: dlQueue.queueUrl,
                FAILURE_BUCKET: failureBucket.bucketName,
                DEBUG_LOGS: 'true',
                DELIVERY_BUCKET: deliveryBucket.bucketName,
                REGION: 'us-east-1'
            }
        } )

        deliveryBucket.grantRead( failureLambda.role! )
        failureBucket.grantReadWrite( failureLambda.role! )
        s3Cmk.grantEncryptDecrypt( failureLambda.role! )
        sqsCmk.grantEncryptDecrypt( failureLambda.role! )
        dlQueue.grantConsumeMessages( failureLambda.role! )

        // Creates an Event Rule that triggers hourly to pull messages from the failure queue
        const failureEventRule = new Rule( this, 'FailureLambdaTrigger', {
            ruleName: `${props.appName}FailureTrigger`,
            description: 'Triggers the failure lambda hourly to get messages from the failure queue',
            schedule: Schedule.rate( Duration.hours( 1 ) )
        } )

        failureEventRule.addTarget( new LambdaFunction( failureLambda ) )








    }
}