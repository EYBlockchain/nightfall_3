const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Nightfall Optimist API',
    description: 'This API is used by proposers',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      email: 'nightfalladmin@polygon.technology',
    },
  },
  servers: [
    {
      url: 'http://localhost:8081',
      description: 'URL to test',
    },
  ],
  paths: {
    '/proposer/update': {
      post: {
        summary: 'Update Proposer',
        description: 'This route will be responsible for update the proposer URL',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/pending-payments': {
      get: {
        summary: 'Pending Payment',
        description: 'Get pending blocks payments for a proposer',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/withdraw': {
      get: {
        summary: 'Withdraw',
        description:
          'Withdraw funds owing to an account, made by a successful challenge or proposed block.  This just provides the tx data, the user will need to call the blockchain client.',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/payment': {
      post: {
        summary: 'Payment',
        description:
          'Withdraw funds owing to an account, made by a successful challenge or proposed block.  This just provides the tx data, the user will need to call the blockchain client.',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/change': {
      get: {
        summary: 'Change current proposer',
        description:
          'Withdraw funds owing to an account, made by a successful challenge or proposed block.  This just provides the tx data, the user will need to call the blockchain client.',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/mempool': {
      get: {
        summary: 'Get Mempool',
        description: 'Get the mempool for a connected proposer',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/encode': {
      post: {
        summary: 'Encode',
        description: '',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/proposer/offchain-transaction': {
      post: {
        summary: 'Off chain transaction',
        description: '',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                    url: 'http://test-proposer1',
                    fee: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Rest API URL not provided',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/UpdateProposerResponse',
                },
                examples: {
                  updateProposerResponse: {
                    value: {
                      txDataToSign:
                        '0x0d602201000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018687474703a2f2f70726f706f736572746573743a383030300000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      UpdateProposerRequest: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
          },
          url: {
            type: 'string',
          },
          fee: {
            type: 'number',
          },
        },
      },
      UpdateProposerResponse: {
        type: 'object',
        txDataToSign: {
          type: 'string',
        },
      },
      withdrawRequest: {},
      withdrawResponse: {},
    },
  },
};

export { swaggerDocument };
