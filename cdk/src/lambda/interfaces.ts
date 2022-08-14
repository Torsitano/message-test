

export interface Payload {
    Records: SqsMessageRecord[]
}

export interface SqsMessageRecord {

    eventVersion: string,
    eventSource: string,
    awsRegion: string,
    eventTime: string,
    userIdentity: {
        principalId: string
    },
    requestParameters: {
        sourceIpAddress: string
    },
    responseElements: {
        'x-amz-request-id': string,
        'x-amz-id-2': string
    },
    s3: S3Payload
}


export interface S3Payload {
    s3SchemaVersion: string,
    configurationId: string,
    bucket: {
        name: string,
        ownerIdentity: {
            principalId: string
        },
        arn: string
    },
    object: {
        key: string,
        size: number,
        eTag: string,
        sequencer: string
    }
}