import { ReceiveMessageCommand, SQSClient, Message, DeleteMessageCommand, ReceiveMessageCommandOutput } from '@aws-sdk/client-sqs'
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Context } from 'aws-lambda'
import { LambdaLog } from 'lambda-log'
import { Payload, SqsMessageRecord } from './interfaces'

const DEBUG_LOGS: boolean = ( process.env.DEBUG_LOGS == 'true' ) ?? false
const DELIVERY_BUCKET = process.env.DELIVERY_BUCKET
const FAILURE_BUCKET = process.env.FAILURE_BUCKET
const DL_QUEUE_URL = process.env.DL_QUEUE_URL
const REGION = process.env.REGION ?? 'us-east-1'


// An array of any key that should have the value redacted during logging
const redactLogProperties: string[] = [ 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN' ]

const log = new LambdaLog( {
    tags: [
        'processing-lambda'
    ],
    debug: DEBUG_LOGS,
    replacer( key: string, value: any ): any {
        if ( redactLogProperties.includes( key ) ) {
            return 'redacted'
        }
        return value
    },
} )

// Setup AWS SDK clients
const sqs = new SQSClient( {
    region: REGION
} )

const s3 = new S3Client( {
    region: REGION
} )



export async function handler( event: any, context: Context ): Promise<void> {
    log.debug( event as any )
    log.debug( context as any )

    if ( !DELIVERY_BUCKET || !FAILURE_BUCKET || !DL_QUEUE_URL ) {
        throw new Error( 'Missing required environment variables' )
    }

    let messages = await receiveMessages()

    while ( messages.Messages ) {
        const messageList = messages.Messages

        // The Lambda will pull up to 10 messages at a time
        await Promise.all( messageList.map( async ( message: Message ): Promise<void> => {
            log.debug( message as any )

            if ( !message.Body ) {
                return
            }

            const payload: Payload = JSON.parse( message.Body )

            // The message payload is an array of records, this copies all the objects and then deletes them
            await Promise.all( payload.Records.map( async ( record: SqsMessageRecord ): Promise<void> => {

                await copyObject( record )
                await deleteObject( record )

            } ) )

            await deleteMessage( message )
        } ) )

        messages = await receiveMessages()
    }
}

/**
 * Receives up to 10 messages from an SQS Queue
 * @returns The promise of the output of the Receive Message command
 */
async function receiveMessages(): Promise<ReceiveMessageCommandOutput> {
    const command = new ReceiveMessageCommand( {
        QueueUrl: DL_QUEUE_URL,
        MaxNumberOfMessages: 10
    } )

    return await sqs.send( command )
}

/**
 * Deletes the message passed as an argument from the queue
 * @param {Message} message - The message to be deleted
 */
async function deleteMessage( message: Message ): Promise<void> {
    const command = new DeleteMessageCommand( {
        QueueUrl: DL_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle
    } )

    await sqs.send( command )
}

/**
 * Copies the object specified in the SQS Message Record to the FAILURE_BUCKET
 * @param {SqsMessageRecord} record - The record containing the information about the S3 Object
 */
async function copyObject( record: SqsMessageRecord ): Promise<void> {
    const command = new CopyObjectCommand( {
        Bucket: FAILURE_BUCKET,
        Key: record.s3.object.key,
        CopySource: `${record.s3.bucket.name}/${record.s3.object.key}`
    } )

    await s3.send( command )
}

/**
 * Deletes the object specified in the SQS Message Record after it's been copied
 * @param {SqsMessageRecord} record - The record containing the information about the S3 Object
 */
async function deleteObject( record: SqsMessageRecord ): Promise<void> {
    const command = new DeleteObjectCommand( {
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key
    } )

    await s3.send( command )
}