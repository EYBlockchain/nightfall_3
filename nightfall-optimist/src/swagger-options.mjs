import config from 'config';

const { optimistApiUrl } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nightfall Optmist API',
      version: '1.0.0',
      description: 'An api to be used by the proposers',
    },
    servers: [
      {
        url: `${optimistApiUrl}`,
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          name: 'x-app-token',
          in: 'header',
        },
      },
      requestBodies: {
        ProposerPayment: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  address: {
                    type: 'string',
                    description: 'Proposer address',
                    example: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                  },
                  blockHash: {
                    type: 'string',
                    description: 'Hash of the payment',
                    example: '0x7fe911936f773030ecaa1cf417b8c24e47cbf5e05b003b8f155bb10b0066956d',
                  },
                },
              },
            },
          },
        },
        ChallengerEnable: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enable: {
                    type: 'boolean',
                    description: 'Option to enable a challenger.',
                    example: 'true',
                  },
                },
              },
            },
          },
        },
        AdvanceWithdrawal: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TransactionHash',
              },
            },
          },
        },
        CheckBlock: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BlockToBeChecked',
              },
            },
          },
        },
      },

      schemas: {
        Block: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            blockHash: {
              type: 'string',
            },
            blockNumber: {
              type: 'number',
            },
            blockNumberL2: {
              type: 'number',
            },
            frontierHash: {
              type: 'string',
            },
            leafCount: {
              type: 'number',
            },
            nCommitments: {
              type: 'number',
            },
            previousBlockHash: {
              type: 'string',
            },
            proposer: {
              type: 'string',
            },
            root: {
              type: 'string',
            },
            timeBlockL2: {
              type: 'string',
            },
            transactionHashL1: {
              type: 'string',
            },
            transactionHashes: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            transactionHashesRoot: {
              type: 'string',
            },
          },
        },
        BlockToBeChecked: {
          type: 'object',
          properties: {
            block: {
              type: 'object',
              example: {},
            },
            transactions: {
              type: 'array',
              example: [],
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
            },
            fee: {
              type: 'string',
            },
            transactionType: {
              type: 'string',
            },
            tokenType: {
              type: 'string',
            },
            historicRootBlockNumberL2: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            historicRootBlockNumberL2Fee: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            tokenId: {
              type: 'string',
            },
            ercAddress: {
              type: 'string',
            },
            recipientAddress: {
              type: 'string',
            },
            commitments: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            nullifiers: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            commitmentFee: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            nullifiersFee: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            compressedSecrets: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            proof: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            transactionHash: {
              type: 'string',
            },
          },
        },
        PendingPayments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              blockHash: {
                type: 'string',
              },
              challengePeriod: {
                type: 'boolean',
              },
            },
          },
          example: {
            blockHash:
              '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
            challengePeriod: false,
          },
        },
        Proposer: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: "The proposer's url.",
            },
            stake: {
              type: 'string',
              description: "The proposer's stake.",
            },
            fee: {
              type: 'integer',
              description: "The proposer's fee.",
            },
          },
          example: {
            url: 'http://proposer1:8587',
            stake: 0,
            fee: 0,
          },
        },
        TxDataToSign: {
          type: 'object',
          properties: {
            txDataToSign: {
              type: 'string',
              description: 'The current proposer address.',
            },
          },
          example: {
            txDataToSign: '0x0d6022010000000000000',
          },
        },
        TransactionHash: {
          type: 'object',
          properties: {
            transactionHash: {
              type: 'string',
              description: 'The transaction hash',
            },
          },
          example: {
            transactionHash: '0xb4c1cd9410b6cc87a0e2fe110ece6bf527fa4f170a4bc8cd032f768fc5219838',
          },
        },
        ABIMock: {
          type: 'object',
          properties: {
            abi: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
          example: {
            abi: {},
          },
        },
        ContractAddress: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The contract address.',
            },
          },
          example: {
            address: '0x864D734aA772516CDbD012366E72ba697273EB53',
          },
        },
        Stake: {
          type: 'object',
          properties: {
            amount: {
              type: 'string',
              description: 'The staked amount of funds of the proposer.',
              example: 10,
            },
            challengeLocked: {
              type: 'string',
              description: 'The block stake in case of an invalid block.',
              example: 10,
            },
            time: {
              type: 'string',
              description: 'The time interval until the stake can be claimed.',
              example: 10,
            },
          },
        },
        DebugCounter: {
          type: 'object',
          properties: {
            counters: {
              type: 'object',
              properties: {
                nBlockInvalid: {
                  type: 'number',
                  description: 'nBlockInvalid',
                  example: 1,
                },
                proposerWsClosed: {
                  type: 'number',
                  description: 'proposerWsClosed',
                  example: 1,
                },
                proposerWsFailed: {
                  type: 'number',
                  description: 'proposerWsFailed',
                  example: 1,
                },
                proposerBlockNotSent: {
                  type: 'number',
                  description: 'proposerBlockNotSent',
                  example: 1,
                },
              },
            },
          },
        },
        ProposersList: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              0: {
                type: 'string',
                description: 'Current proposer address.',
              },
              1: {
                type: 'string',
                description: 'Previous proposer address.',
              },
              2: {
                type: 'string',
                description: 'Next proposer address.',
              },
              3: {
                type: 'string',
                description: "Proposer's url.",
              },
              4: {
                type: 'string',
                description: "Proposer's fee.",
              },
              5: {
                type: 'boolean',
                description: 'Proposer in.',
              },
              6: {
                type: 'string',
                description: 'Proposer index.',
              },
              thisAddress: {
                type: 'integer',
                description: 'Current proposer address.',
              },
              previousAddress: {
                type: 'string',
                description: 'Previous proposer address.',
              },
              nextAddress: {
                type: 'string',
                description: 'Next proposer address.',
              },
              url: {
                type: 'string',
                description: "Proposer's url.",
              },
              fee: {
                type: 'string',
                description: "Proposer's fee.",
              },
              inProposerSet: {
                type: 'boolean',
                description: 'Proposer in.',
              },
              indexProposerSet: {
                type: 'string',
                description: 'Proposer index.',
              },
            },
          },
          example: {
            proposers: [
              {
                0: '0x0000000000000000000000000000000000000000',
                1: '0x0000000000000000000000000000000000000000',
                2: '0x0000000000000000000000000000000000000000',
                3: '',
                4: '0',
                5: false,
                6: '0',
                thisAddress: '0x0000000000000000000000000000000000000000',
                previousAddress: '0x0000000000000000000000000000000000000000',
                nextAddress: '0x0000000000000000000000000000000000000000',
                url: '',
                fee: '0',
                inProposerSet: false,
                indexProposerSet: '0',
              },
            ],
          },
        },
        RequestBody: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
          },
          required: ['code', 'message'],
        },
        BlockReseted: {
          type: 'object',
          properties: {
            block: {
              resetstatus: 'boolean',
              example: true,
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Proposer address',
              example: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
            },
            blockHash: {
              type: 'string',
              description: 'Hash of the payment',
              example: '0x7fe911936f773030ecaa1cf417b8c24e47cbf5e05b003b8f155bb10b0066956d',
            },
          },
        },
      },
      responses: {
        NotFound: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RequestBody',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RequestBody',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RequestBody',
              },
            },
          },
        },
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RequestBody',
              },
            },
          },
        },
        SuccessBlockChecked: {
          description: 'Block without inconsistency.',
        },
        SuccessBlockCreated: {
          description: 'Making short block.',
        },
        SuccessAdvanceWithdrawal: {
          description: 'Sucessful advance withdrawal.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
        Success: {
          description: 'OK. Successful request.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RequestBody',
              },
            },
          },
        },
        SuccessDebugContract: {
          description: 'The numbers for debug counters returned.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DebugCounter',
              },
            },
          },
        },
        SuccessGetContractAbi: {
          description: 'Contract ABI returned.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ABIMock',
              },
            },
          },
        },
        SuccessGetContractAddress: {
          description: 'Contract address returned.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ContractAddress',
              },
            },
          },
        },
        SuccessProposerRegister: {
          description: 'Proposer registered.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
        SuccessProposerUpdate: {
          description: 'Proposer updated.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },

        SuccessBlockReseted: {
          description: 'Block reseted.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BlockReseted',
              },
            },
          },
        },
        SuccessCurrentProposer: {
          description: 'Current proposer returned.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  currentProposer: {
                    type: 'string',
                    example: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                  },
                },
              },
            },
          },
        },
        SuccessProposerList: {
          description: 'Proposer updated.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ProposersList',
                },
              },
            },
          },
        },
        SuccessDeregisterProposer: {
          description: 'Proposer deregistered.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
        SuccessWithdrawStake: {
          description: 'Stake withdraw.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
        SuccessPendingPayments: {
          description: 'Pending payments recieved.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/PendingPayments',
                },
              },
            },
          },
        },
        SuccessCurrentStake: {
          description: 'Current stake.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  amount: {
                    type: 'string',
                    description: 'The staked amount of funds of the proposer.',
                    example: 10,
                  },
                  challengeLocked: {
                    type: 'string',
                    description: 'The block stake in case of an invalid block.',
                    example: 10,
                  },
                  time: {
                    type: 'string',
                    description: 'The time interval until the stake can be claimed.',
                    example: 10,
                  },
                },
              },
            },
          },
        },
        SuccessProposerPayment: {
          description: 'Proposer payment created.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
        SuccessWithdrawPayment: {
          description: 'Withdrawal created.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/TxDataToSign',
                },
              },
            },
          },
        },
        SuccessChangeProposer: {
          description: 'Proposer changed.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TxDataToSign',
              },
            },
          },
        },
      },
    },
  },
  apis: ['src/routes/**/*.mjs'],
};
export default options;
