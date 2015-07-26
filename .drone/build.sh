#!/bin/bash
npm install -g grunt-cli
npm install
grunt build

# Required for S3 Deployment
wget https://bootstrap.pypa.io/get-pip.py
python get-pip.py
pip install awscli
