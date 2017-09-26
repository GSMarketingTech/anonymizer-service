## Introduction

This node.js module can be used to anonymize information by replacing Personal Identifiable Information (PII) with fake data. 

## Install

To install, run:
```sh
$ npm install anonymizer-service
```

## Synopsis

In order to use the module, you must first create an AWS account. Once you have an account, the tools included in this module will allow you to deploy the anonymizing-service Lambda function to your AWS account, create a REST service that uses JSON for data interchange to interact with the Lambda function, setup your database, and populate your database with phony data. The purpose of the database is to insure that the anonymized data mirrors the original data, but with phony values instead of PII.

You can interact with the anonymizing service by sending API requests with the data that you want to anonymize. The response will include a JSON with the anonymized data. The API will replace all PII with the phony data that is mapped to it in the database. If a PII has not been mapped to a phony value, a phony value will be assigned to it and the relationship will be stored in the database.

The following information is considered PII:

* First and last name
* Middle initial
* Phone Number
* Email
* Address

There are other fields that are not necessarily PII but can include identifiable information (e.g. comments, passwords, xmls etc.). To help with these cases, the service gives you the ability to convert or generate new data for these fields. 

The built-in data generators allow you to do the following:

* Generate random passwords
* Replace text with Lorem Ipsum
* Convert text to hash
* Replace xml content with Lorem Ipsum

## Usage

### Prerequisites
1. Create an [AWS service account](https://aws.amazon.com/).
2. Create a database backend.
3. Create an [IAM role](https://console.aws.amazon.com/iam/home#/roles) for the anonymizer-service Lambda function and give the role the proper permissions to access the database .
4. Copy the file *etc/anonymizer-service.config.tmpl.json* name it *anonymizer-service.config.json*. Edit the file by replacing any values surrounded by angle brackets with the appropriate information. This file will outline configurations that are needed to deploy the Lambda function to AWS. 
5. Copy the file *etc/anonymizer-service.api.config.tmpl.json* and name it *anonymizer-service.api.config.json*. Edit the file by replacing any values surrounded by angle brackets with the appropriate information. This file will outline configurations that are needed to create the anonymizer-service API in AWS. 
6. Copy the file *etc/db.tmpl.json* and name it *db.json*. Edit the file by include the following information about your database: database (name), password, port, host, and user.
7. Inside the *phony-data* folder, you will find empty CSV files. Here, you can dump phony data values that you want to store in the database (look [below](#phony-data-files) for more information on how to format these files). The files follow a common naming convention. The name starts with 'phony_' and is followed by a PII type (e.g. *phony_email.csv*). 

#### Phony data files
The files containing the fake data must be in a [CSV](https://support.bigcommerce.com/articles/Public/What-is-a-CSV-file-and-how-do-I-save-my-spreadsheet-as-one) format. CSV stands for *comma separated values* and is used to store flat data. Each row in a CSV file represents a record to be indexed and every column is a field. In this case, only one field is needed per record, the *phony value*, so there should only be one column/value per row. Here are a couple examples of what a csv should look like:

*phony_first.csv*
```text
Anna
Sebastian
Rajah
Aurora
Merida
Flynn
Fa
Adam
```

*phony_address.csv*
```text
123 Agrabah Avenue,
8888 Low Countries St.,
789 Monaco Rd. Apt.# 456,
111A Virginia Blvd.,
654 Archduchy Ct.
```

### Setup
```sh
$ npm run kmsEncryptJson $region <region> $keyArn <keyArn>
```
This command will encrypt the database json file that you created in step 6 above. 

Replace '<region>' with your AWS region. 
Replace '<keyArn>' with the [ARN of the KMS key](https://console.aws.amazon.com/iam/home#/encryptionKeys/) that you want to use to encrypt.

Once you have encrypted your database credentials, you can setup and deploy the Lambda function by running the following command:

```sh
$ npm run setup
```

This command will setup the needed PII tables in your database, populate the phony data tables using the CSV files you created in step 7 above, zip and deploy your Lambda function, and create the API.

#### Other Commands

You can also run each of these tools on their own.

```sh
$ npm run setupDatabase
```
This command will create the necessary PII tables in your database. Adding the 'recreate' option will drop all the PII tables and recreate them (all existing data will be lost). If you don't include the 'recreate' option, it will create the tables if they do not exist.

```sh
$ npm run insertPhonyData phonyDataDir
```
This command will populate the PII phony data tables with data in the CSV files from step 7 above. You can add more phony values to the database using this command at any time (it will not replace/remove any previous values). __Note__: the tool does not index files larger than 250 MB.

```sh
$ npm run deployLambda
```
This command will create a zip of all the files used by the anonymizing Lambda function and will deploy the Lambda function to AWS. If the function does not exist, it will create a new one. If it does, it will update the code and configurations.

```sh
$ npm run upsertApi
```
This command will create a new API Gateway for the anonymizer service or update it if it already exists.

### API Usage

#### Example Request
__method__: POST

__endpoint__: /anonymize

__content-type__: application/json

__accept__: application/json

__body__:
```json
{
    "columns": [ 
      "phony_first", 
      "phony_last", 
      "phony_email", 
      {
        "type": "phony_password",
        "min": 10,
        "max": 15
      },
      "job"
    ],
    "rows": [
      [
        "Ella",
        "Gertrude",
        "cinder@yahoo.com",
        "glassSlipper123",
        "Shoe model"
      ],
      [
        "John",
        "Smith",
        "jsmith@outlook.com",
        "Jamestown1!",
        "Geologist"
      ]
    ]
}
```
__columns__: array of columns; these column names will determine how the data under that column will be handled. Notice that one of the elements in the columns array is not a string like the rest. This is because the PII type *phony_password* has customizable options (min and max).

__rows__: array of arrays; each inner array will contain a row of data. The rows contain the data to be cleansed. The order of the data values in each row must match up with the column types.

##### Endpoint
To find the default host name, navigate to the *anonymizer-service* api in the AWS API Gateway console. In the __Stage Editor__ pane, the endpoint will be located under __Invoke URL__.

#### Possible columns
* phony_first *(PII)*: first names
* phony_last *(PII)*: last names
* phony_mi *(PII)*: middle initials
* phony_email *(PII)*: email addresses
* phony_phone *(PII)*: phone numbers
* phony_address *(PII)*: street addresses
* phony_hash *(non-PII)*: data under this column will be converted to a hash
* phony_loremipsum *(non-PII)*: data under this column will be turned into Lorem Ipsum text of the same length
* phony_password *(non-PII)*: data under this column will be turned into a randomly generated string including alphanumeric characters and symbols. You can specify a *min* and a *max*, if you do not specify these values, the default values will be used. These are 8 and 20, respectively.
* phony_latitude *(non-PII)*: data under this column will remain unchanged
* phony_longitude *(non-PII)*: data under this column will remain unchanged
* phony_xml *(non-PII)*: data under this column will return an xml with Lorem Ipsum content. The xml tags will remain the same and the content 
between the tags will have the same length as the original text.
* phony_  *(non-PII)*: data under this column will remain unchanged

All data under PII columns will be mapped to their phony values. Data under non-PII columns will be either be replaced with new generated data, or remain the same, depending on the type. Non-pii values are not mapped in the database so their values will not remain consistent. Any data under columns that do not include "phony_" as part of its name will remain unchanged.

#### Example Success Response
__status__: 200

__content-type__: application/json

__access-control-allow-origin__: *

__body__:
```json
{
    "columns": [
      "phony_first", 
      "phony_last", 
      "phony_email", 
      {
        "type": "phony_password",
        "min": 10,
        "max": 15
      },
      "job"
    ],
    "rows": [
      [
        "Eric",
        "Powhatan",
        "abc@gmail.com",
        "kc<yi&kej52",
        "Shoe model"
      ],
      [
        "Jasmine",
        "Tremaine",
        "123@hotmail.com",
        "ku7BjM425*lP",
        "Geologist"
       ]
    ]
}
```

__columns__: the columns specified in the request

__rows__: the anonymized data. The order of the rows and columns in the request is maintained in the response.

#### Example Error Response
__status__: 400

__content-type__: application/json

__access-control-allow-origin__: *

__body__:
```json
{
  "error": {
    "source": "Bad request",
    "description": "Empty or malformed request"
  }
}
```

__error__: a container for error details


##### HTTP Status Codes

| Code | Source                      | Description |
|:---- | :-------------------------- | :---------- |
| 200  | OK                          | Success! |
| 400  | Bad request                 | The request was invalid. This may be caused by invalid content type, field names, or field types. |
| 401  | Invalid credentials         | This error indicates an error during authorization. One possible reason could be missing or invalid database credentials. |
| 413  | Request body is too large   | The body does not meet size boundaries. |
| 500  | Internal server error       | The code threw an exception during execution. The error body should throw more descriptions such as the error message and stack trace.  |
| 503  | Connection error            | An error was encountered while trying to connect to a service, such as failure to connect to the database. |
| 507  | Insufficient data           | Insufficient phony values in the database to complete the request. |

#### Request Limitations

| Resource | Limit |
|:-------- | :---- |
| Request size | 10 MB |
| New PII fields to be anonymized | 10,000 |
| Total Pii fields to be processed (including new PII) | 100,000 |
| Non Pii fields to be processed | 100,000 |


## Running tests

The module includes suites of unit tests. The unit tests run on any machine and do not require a database back end.

To test, run:

```sh
$ npm test
```

## License

Copyright 2017 GS Marketing, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Credits

Lorem Ipsum text was taken from [here](http://loremipsum.net/).
