# Claim Check Serverless Object Processing Construct

This repo contains two versions of an object store for messaging deployment, complete with a Lambda to handle objects that couldn't be processed.

The two deployments should be nearly identical, one written in traditional AWS CDK, the other in CDKTF. Each directory contains a README to account for the differences in use.

Note: If there are errors with the Lambda right after deployment, purge the DL Queue to remove the test message that may be sent during deployment.