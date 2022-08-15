import { Construct } from 'constructs'
import { KmsAlias, KmsKey, KmsKeyConfig } from '@cdktf/provider-aws/lib/kms'
import { SqsQueue, SqsQueueConfig } from '@cdktf/provider-aws/lib/sqs'
//@ts-ignore
import { S3Bucket, S3BucketNotification, S3BucketPublicAccessBlock, S3BucketServerSideEncryptionConfigurationA, S3BucketServerSideEncryptionConfigurationRuleA, S3Object } from '@cdktf/provider-aws/lib/s3'
import { LambdaEventSourceMapping, LambdaFunction, LambdaFunctionConfig, LambdaPermission } from '@cdktf/provider-aws/lib/lambdafunction'
import { CloudwatchEventRule, CloudwatchEventTarget } from '@cdktf/provider-aws/lib/eventbridge'
import { AssetType, TerraformAsset } from 'cdktf'
import { IamRole } from '@cdktf/provider-aws/lib/iam'

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
    lambdaOverrides?: Partial<LambdaFunctionConfig>
}



export class CustomMessageConstruct extends Construct {
    readonly s3Cmk: KmsKey
    readonly sqsCmk: KmsKey
    readonly messageQueue: SqsQueue
    readonly dlQueue: SqsQueue
    readonly deliveryBucket: S3Bucket
    readonly failureBucket: S3Bucket
    readonly lambdaRole: IamRole
    readonly processingLambda: LambdaFunction
    readonly failureLambda: LambdaFunction
    readonly failureEventRule: CloudwatchEventRule

    constructor ( scope: Construct, name: string, props: MessageConstructProps ) {
        super( scope, name )

        const sqsCmkPolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: {
                        AWS: `arn:aws:iam::${props.awsAccountId}:root`
                    },
                    Action: 'kms:*',
                    Resource: '*'
                },
                {
                    Effect: 'Allow',
                    Principal: {
                        Service: 's3.amazonaws.com'
                    },
                    Action: [
                        'kms:Decrypt',
                        'kms:Encrypt',
                        'kms:GenerateDataKey*',
                        'kms:ReEncrypt*'
                    ],
                    Resource: '*',
                    Condition: {
                        ArnLike: {
                            'aws:SourceArn': ( `arn:aws:s3:::${props.appName}-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase()
                        }
                    }
                },
                {
                    Effect: 'Allow',
                    Principal: {
                        Service: 's3.amazonaws.com'
                    },
                    Action: [
                        'kms:Decrypt',
                        'kms:GenerateDataKey*'
                    ],
                    Resource: '*'
                }
            ]
        }

        // Create the CMKs used to encrypt all resources this deploys
        const defaultKmsConfig: Partial<KmsKeyConfig> = {
            enableKeyRotation: true,
            deletionWindowInDays: 7,
            isEnabled: true
        }

        this.s3Cmk = new KmsKey( this, 'S3Cmk', {
            ...defaultKmsConfig,
            description: 'KMS CMK used for S3 Buckets'
        } )

        new KmsAlias( this, 'S3CmkAlias', {
            targetKeyId: this.s3Cmk.id,
            name: `alias/${props.appName}S3Cmk`
        } )

        this.sqsCmk = new KmsKey( this, 'SqsCmk', {
            ...defaultKmsConfig,
            description: 'KMS CMK used for SQS Queues',
            policy: JSON.stringify( sqsCmkPolicy )
        } )

        new KmsAlias( this, 'SqsCmkAlias', {
            targetKeyId: this.sqsCmk.id,
            name: `alias/${props.appName}SqsCmk`
        } )


        // Setup default config shared by the SQS Queues
        const defaultQueueConfig: Partial<SqsQueueConfig> = {
            kmsMasterKeyId: this.sqsCmk.id
        }


        // Create both the DL and processing message queues
        this.dlQueue = new SqsQueue( this, 'DLQueue', {
            ...defaultQueueConfig,
            name: `${props.appName}DLQueue${props.environment}`,
            messageRetentionSeconds: 21600
        } )


        const messageQueuePolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: {
                        Service: 's3.amazonaws.com'
                    },
                    Action: [
                        'sqs:GetQueueAttributes',
                        'sqs:GetQueueUrl',
                        'sqs:SendMessage'
                    ],
                    Resource: `arn:aws:sqs:us-east-1:${props.awsAccountId}:${props.appName}MessageQueue${props.environment}`,
                    Condition: {
                        ArnLike: {
                            'aws:SourceArn': ( `arn:aws:s3:::${props.appName}-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase()
                        }
                    }
                }
            ]
        }

        // The redrivePolicy property expects a JSON string
        const redrivePolicy = {
            deadLetterTargetArn: this.dlQueue.arn,
            maxReceiveCount: 3
        }

        this.messageQueue = new SqsQueue( this, 'MessageQueue', {
            ...defaultQueueConfig,
            name: `${props.appName}MessageQueue${props.environment}`,
            redrivePolicy: JSON.stringify( redrivePolicy ),
            visibilityTimeoutSeconds: 30,
            policy: JSON.stringify( messageQueuePolicy )
        } )

        // Setup the default S3 Encryption config used by both Buckets
        const defaultBucketEncryptionConfig: S3BucketServerSideEncryptionConfigurationRuleA = {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
                sseAlgorithm: 'aws:kms',
                kmsMasterKeyId: this.s3Cmk.id
            }
        }

        this.deliveryBucket = new S3Bucket( this, 'DeliveryBucket', {
            bucket: ( `${props.appName}-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase()
        } )


        this.failureBucket = new S3Bucket( this, 'FailureBucket', {
            bucket: ( `${props.appName}-failed-delivery-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase(),
        } )

        // Terraform has deprecated including the encrytpion in the initial properties and
        // recommends it be setup as another resource
        new S3BucketServerSideEncryptionConfigurationA( this, 'DeliveryEncryption', {
            bucket: this.deliveryBucket.bucket,
            rule: [
                defaultBucketEncryptionConfig
            ]
        } )

        new S3BucketServerSideEncryptionConfigurationA( this, 'FailureEncryption', {
            bucket: this.failureBucket.bucket,
            rule: [
                defaultBucketEncryptionConfig
            ]
        } )

        // Block Public Access settings for both buckets
        new S3BucketPublicAccessBlock( this, 'BPADeliveryBucket', {
            bucket: this.deliveryBucket.bucket,
            blockPublicPolicy: true
        } )

        new S3BucketPublicAccessBlock( this, 'BPAFailureBucket', {
            bucket: this.failureBucket.bucket,
            blockPublicPolicy: true
        } )

        new S3BucketNotification( this, 'CreateNotification', {
            bucket: this.deliveryBucket.bucket,
            queue: [ {
                events: [
                    's3:ObjectCreated:*'
                ],
                queueArn: this.messageQueue.arn
            } ],

        } )

        // Allows the Lambda IAM Role to be assumed by the service
        const lambdaTrustPolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: 'sts:AssumeRole',
                    Principal: {
                        Service: 'lambda.amazonaws.com'
                    }
                }
            ]
        }

        const rolePolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: [
                        's3:Abort*',
                        's3:DeleteObject*',
                        's3:GetBucket*',
                        's3:GetObject*',
                        's3:List*',
                        's3:PutObject',
                        's3:PutObjectLegalHold',
                        's3:PutObjectRetention',
                        's3:PutObjectTagging',
                        's3:PutObjectVersionTagging'
                    ],
                    Resource: [
                        this.deliveryBucket.arn,
                        `${this.deliveryBucket.arn}/*`,
                        this.failureBucket.arn,
                        `${this.failureBucket.arn}/*`
                    ]
                },
                {
                    Effect: 'Allow',
                    Action: [
                        'kms:Decrypt',
                        'kms:DescribeKey',
                        'kms:Encrypt',
                        'kms:GenerateDataKey*',
                        'kms:ReEncrypt*'
                    ],
                    Resource: [
                        this.s3Cmk.arn,
                        this.sqsCmk.arn
                    ]
                },
                {
                    Effect: 'Allow',
                    Action: [
                        'sqs:ChangeMessageVisibility',
                        'sqs:DeleteMessage',
                        'sqs:GetQueueAttributes',
                        'sqs:GetQueueUrl',
                        'sqs:ReceiveMessage'
                    ],
                    Resource: [
                        this.messageQueue.arn,
                        this.dlQueue.arn
                    ]
                }
            ]
        }

        // This IAM Role is used by both Lambdas for simplicitiy
        this.lambdaRole = new IamRole( this, 'LambdaRole', {
            assumeRolePolicy: JSON.stringify( lambdaTrustPolicy ),
            managedPolicyArns: [
                'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ],
            inlinePolicy: [
                {
                    name: 'AllowAllTheThings',
                    policy: JSON.stringify( rolePolicy )
                }
            ]
        } )

        // Used to store the Zip files for the Lambda code
        const lambdaUploadBucket = new S3Bucket( this, 'TerraformLambdaBucket', {
            bucket: ( `${props.appName}-tf-lambda-bucket-${props.environment}-${props.awsAccountId}` ).toLowerCase(),
        } )

        // Zips and archives the files for Lambda
        const processingLambdaAsset = new TerraformAsset( this, 'ProcessingAsset', {
            path: props.processingLambdaCode,
            type: AssetType.ARCHIVE
        } )

        const processingLambdaArchive = new S3Object( this, 'ProcessingArchive', {
            bucket: lambdaUploadBucket.bucket,
            key: `${props.appName}-processing-${processingLambdaAsset.fileName}`,
            source: processingLambdaAsset.path
        } )

        const failureLambdaAsset = new TerraformAsset( this, 'FailureAsset', {
            path: './dist/failedDelivery',
            type: AssetType.ARCHIVE
        } )

        const failureLambdaArchive = new S3Object( this, 'FailureArchive', {
            bucket: lambdaUploadBucket.bucket,
            key: `${props.appName}-failure-${failureLambdaAsset.fileName}`,
            source: failureLambdaAsset.path
        } )


        const lambdaDefaults: Partial<LambdaFunctionConfig> = {
            memorySize: 128,
            s3Bucket: lambdaUploadBucket.bucket,
            timeout: 30,
            runtime: 'nodejs16.x'
        }

        this.processingLambda = new LambdaFunction( this, 'ProcessingLambda', {
            ...lambdaDefaults,
            ...props.lambdaOverrides,
            role: this.lambdaRole.arn,
            functionName: `${props.appName}ProcessingLambda`,
            description: 'Processes objects put into the S3 Bucket for inbound payloads',
            handler: 'processMessage.handler',
            s3Key: processingLambdaArchive.key,
            environment: {
                variables: {
                    DEBUG_LOGS: 'true',
                    FAILURE_TEST: 'true',
                    DELIVERY_BUCKET: this.deliveryBucket.bucket
                }
            }
        } )

        new LambdaEventSourceMapping( this, 'ProcessingTrigger', {
            functionName: this.processingLambda.functionName,
            eventSourceArn: this.messageQueue.arn,
            batchSize: 1
        } )


        this.failureLambda = new LambdaFunction( this, 'FailureLambda', {
            ...lambdaDefaults,
            role: this.lambdaRole.arn,
            functionName: `${props.appName}FailureLambda`,
            description: 'Polls the failed queue to put S3 Objects into the failed Bucket for follow-up',
            handler: 'failedDelivery.handler',
            s3Key: failureLambdaArchive.key,
            environment: {
                variables: {
                    DL_QUEUE_URL: this.dlQueue.url,
                    FAILURE_BUCKET: this.failureBucket.bucket,
                    DEBUG_LOGS: 'true',
                    DELIVERY_BUCKET: this.deliveryBucket.bucket,
                    REGION: 'us-east-1'
                }
            }
        } )


        this.failureEventRule = new CloudwatchEventRule( this, 'FailureLambdaTrigger', {
            name: `${props.appName}FailureTrigger`,
            description: 'Triggers the failure lambda to get messages from the failure queue',
            scheduleExpression: 'rate(1 hour)',
            isEnabled: true
        } )

        new CloudwatchEventTarget( this, 'EventRuleTarget', {
            arn: this.failureLambda.arn,
            rule: this.failureEventRule.name
        } )

        new LambdaPermission( this, 'EventRuleInvokeFailLambda', {
            functionName: this.failureLambda.functionName,
            principal: 'events.amazonaws.com',
            action: 'lambda:InvokeFunction'
        } )




    }
}