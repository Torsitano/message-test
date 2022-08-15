
import { S3BucketServerSideEncryptionConfigurationA } from '@cdktf/provider-aws/lib/s3'
import 'cdktf/lib/testing/adapters/jest' // Load types for expect matchers
import { Testing } from 'cdktf'
import { CustomMessageConstruct } from '../lib/constructs/MessageConstruct'
import { SqsQueue } from '@cdktf/provider-aws/lib/sqs'
import { MessageStack } from '../lib/stacks/MessageStack'



describe( 'My CDKTF Application', () => {

    const template = Testing.synthScope( ( scope ) => {
        new CustomMessageConstruct( scope, 'MessageDeployment', {
            environment: 'Prod',
            appName: 'MessageTestTf',
            processingLambdaCode: './dist/processMessage/',
            awsAccountId: '698852667105',
            lambdaOverrides: {
                memorySize: 256,
                timeout: 60
            }
        } )
    } )

    it( 'should have S3 encryption with KMS', () => {
        expect( template ).toHaveResourceWithProperties( S3BucketServerSideEncryptionConfigurationA, {
            rule: [ {
                apply_server_side_encryption_by_default: {
                    kms_master_key_id: '${aws_kms_key.MessageDeployment_S3Cmk_AA2B7668.id}',
                    sse_algorithm: 'aws:kms'
                },
                bucket_key_enabled: true
            } ]
        } )
    } )


    it( 'should have SQS encryption with KMS', () => {
        expect( template ).toHaveResourceWithProperties( SqsQueue, {
            kms_master_key_id: '${aws_kms_key.MessageDeployment_SqsCmk_2846ADEE.id}'
        } )
    } )

    it( 'should have DL queue on delivery queue', () => {
        expect( template ).toHaveResourceWithProperties( SqsQueue, {
            redrive_policy: '{"deadLetterTargetArn":"${aws_sqs_queue.MessageDeployment_DLQueue_B89DEAD6.arn}","maxReceiveCount":3}'
        } )
    } )

} )


describe( 'Checking validity', () => {
    it( 'check if the produced terraform configuration is valid', () => {
        const app = Testing.app()
        const stack = new MessageStack( app, 'MessageStackCdkTf' )
        expect( Testing.fullSynth( stack ) ).toBeValidTerraform()
    } )
} )
