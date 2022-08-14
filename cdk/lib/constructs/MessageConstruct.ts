import { Construct } from 'constructs'
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import { Key, KeyProps } from 'aws-cdk-lib/aws-kms'
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
     * The location of the code for the processing Lambda
     */
    processingLambdaCode: string,
    /**
     * 
     */
    awsAccountId: string,
    /**
     * Allows setting config options like timeout and memory size
     */
    lambdaOverrides?: Partial<NodejsFunctionProps>
}

/**
 * 
 */
export class CustomMessageConstruct extends Construct {
    readonly s3Cmk: Key
    readonly sqsCmk: Key
    readonly messageQueue: Queue
    readonly dlQueue: Queue
    readonly deliveryBucket: Bucket
    readonly failureBucket: Bucket
    readonly processingLambda: NodejsFunction
    readonly failureLambda: NodejsFunction
    readonly failureEventRule: Rule

    constructor ( scope: Construct, id: string, props: MessageConstructProps ) {
        super( scope, id )


        const defaultKmsConfig: Partial<KeyProps> = {
            enabled: true,
            enableKeyRotation: true,
            pendingWindow: Duration.days( 7 ),
            removalPolicy: RemovalPolicy.DESTROY
        }

        // Create the CMK used to encrypt all resources this deploys
        this.s3Cmk = new Key( this, 'S3Cmk', {
            ...defaultKmsConfig,
            alias: `${props.appName}S3Cmk`,
            description: 'KMS CMK used for message queue'
        } )

        this.sqsCmk = new Key( this, 'SqsCmk', {
            ...defaultKmsConfig,
            alias: `${props.appName}SqsCmk`,
            description: 'KMS CMK used for DL queue'
        } )


        // Setup default config shared by the SQS Queues
        const defaultQueueConfig: Partial<QueueProps> = {
            encryption: QueueEncryption.KMS,
            encryptionMasterKey: this.sqsCmk,
        }


        // Create both the DL and processing message queues
        this.dlQueue = new Queue( this, 'DLQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}DLQueue${props.environment}`,
            retentionPeriod: Duration.seconds( 21600 )
        } )

        this.messageQueue = new Queue( this, 'MessageQueue', {
            ...defaultQueueConfig,
            queueName: `${props.appName}MessageQueue${props.environment}`,
            deadLetterQueue: {
                queue: this.dlQueue,
                maxReceiveCount: 3
            },
            // Set visibility timeout to the timeout of the processing function + 30 seconds
            visibilityTimeout: Duration.seconds( 30 ) //props.processingLambda.timeout!.plus( Duration.seconds( 30 ) )
        } )


        // Setup the default S3 config used by both Buckets
        const defaultBucketConfig: Partial<BucketProps> = {
            encryption: BucketEncryption.KMS,
            encryptionKey: this.s3Cmk,
            bucketKeyEnabled: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        }

        // The Bucket names are lower cased to ensure whatever is passed will be allowed for S3 naming standards
        this.deliveryBucket = new Bucket( this, 'DeliveryBucket', {
            ...defaultBucketConfig,
            bucketName: ( `${props.appName}-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase()
        } )

        // Send messages to SQS when an object is created in the S3 Bucket
        this.deliveryBucket.addObjectCreatedNotification(
            new SqsDestination( this.messageQueue )
        )

        this.failureBucket = new Bucket( this, 'FailureBucket', {
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

        // This would need better logic for a real deployment instead of just merging a bunch of stuff with spread
        this.processingLambda = new NodejsFunction( this, 'processingLambda', {
            ...lambdaDefaults,
            ...props.lambdaOverrides,
            entry: props.processingLambdaCode,
            functionName: `${props.appName}ProcessingLambda`,
            description: 'Processes objects put into the S3 Bucket for inbound payloads',
            environment: {
                DEBUG_LOGS: 'true',
                FAILURE_TEST: 'true',
                DELIVERY_BUCKET: this.deliveryBucket.bucketName
            }
        } )

        this.processingLambda.addEventSource( new SqsEventSource( this.messageQueue, {
            batchSize: 1
        } ) )

        // Granting permissions to the Processing Lambda IAM Role
        this.deliveryBucket.grantRead( this.processingLambda.role! )
        this.s3Cmk.grantEncryptDecrypt( this.processingLambda.role! )
        this.sqsCmk.grantEncryptDecrypt( this.processingLambda.role! )
        this.messageQueue.grantConsumeMessages( this.processingLambda.role! )

        this.failureLambda = new NodejsFunction( this, 'failureLambda', {
            ...lambdaDefaults,
            entry: './src/lambda/failedDelivery.ts',
            functionName: `${props.appName}FailureLambda`,
            description: 'Polls the failed queue to put S3 Objects into the failed Bucket for follow-up',
            environment: {
                DL_QUEUE_URL: this.dlQueue.queueUrl,
                FAILURE_BUCKET: this.failureBucket.bucketName,
                DEBUG_LOGS: 'true',
                DELIVERY_BUCKET: this.deliveryBucket.bucketName,
                REGION: 'us-east-1'
            }
        } )

        // Granting permissions to the Failure Lambda IAM Role
        this.deliveryBucket.grantReadWrite( this.failureLambda.role! )
        this.failureBucket.grantReadWrite( this.failureLambda.role! )
        this.s3Cmk.grantEncryptDecrypt( this.failureLambda.role! )
        this.sqsCmk.grantEncryptDecrypt( this.failureLambda.role! )
        this.dlQueue.grantConsumeMessages( this.failureLambda.role! )

        // Creates an Event Rule that triggers hourly to pull messages from the failure queue
        this.failureEventRule = new Rule( this, 'FailureLambdaTrigger', {
            ruleName: `${props.appName}FailureTrigger`,
            description: 'Triggers the failure lambda hourly to get messages from the failure queue',
            schedule: Schedule.rate( Duration.minutes( 1 ) )
        } )

        this.failureEventRule.addTarget( new LambdaFunction( this.failureLambda ) )

    }
}