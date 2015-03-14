deploy.zip: CreateThumbnail.js
	zip deploy.zip -r node_modules CreateThumbnail.js

deploy: deploy.zip
	aws lambda delete-function \
                --region us-west-2 \
                --function-name CreateThumbnail  
	aws lambda upload-function \
                --region us-west-2 \
                --function-name CreateThumbnail  \
                --function-zip deploy.zip \
                --role arn:aws:iam::588888406661:role/executionrole \
                --mode event \
                --handler CreateThumbnail.handler \
                --runtime nodejs \
                --timeout 60 \
                --memory-size 1024
	
test:
	aws lambda invoke-async  --region us-west-2  --function-name "CreateThumbnail"   --invoke-args "data.json"
