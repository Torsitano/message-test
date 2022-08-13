#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { getBuildConfig } from './buildUtils'
import { MessageStack } from './stacks/MessageStack'

const app = new cdk.App()

const buildConfig = getBuildConfig( app )
console.log( 'Building with the following parameters: \n', buildConfig )


new MessageStack( app, 'MessageStack', buildConfig, {
    env: {
        account: buildConfig.awsAccountId,
        region: buildConfig.region
    }
} )
