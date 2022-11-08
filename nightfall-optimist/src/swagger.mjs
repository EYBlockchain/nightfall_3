const txDataToSign = {
  type: 'string',
};

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
      email: 'nightfalladmin@polygon.technology ',
    },
  },
  servers: [
    {
      url: 'http://localhost:8081',
      description: 'URL to test',
    },
  ],
  paths: {
    /**
     * @description Update proposer path
     */
    '/proposer/register': {
      post: {
        summary: 'Update Proposer',
        description: 'This route will be responsible for register a new proposer.',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterProposerRequest',
              },
              examples: {
                registerProposerRequest: {
                  value: {
                    url: 'http://test-proposer1',
                    stake: 0,
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
                  $ref: '#/components/schemas/TxDataToSign',
                },
                examples: {
                  registerProposerResponse: {
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
    /**
     * @description Update proposer path
     */
    '/proposer/update': {
      post: {
        summary: 'Update Proposer',
        description: 'This route will be responsible for update the proposer URL.',
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
                  $ref: '#/components/schemas/TxDataToSign',
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
    /**
     * @description Get current proposer path
     */
    '/proposer/current-proposer': {
      get: {
        summary: 'Get the current Proposer',
        description: 'This route will be responsible for return the current proposer.',
        tags: ['Proposer'],
        responses: {
          500: {
            description: 'Some error ocurred.',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/CurrentProposerResponse',
                },
                examples: {
                  currentProposerResponse: {
                    value: {
                      currentProposer: '0x0000000000000000000000000000000000000000',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    /**
     * @description Get proposers path
     */
    '/proposer/proposers': {
      get: {
        summary: 'Get all proposers',
        description: 'This route will be responsible for return all the proposers.',
        tags: ['Proposer'],
        responses: {
          500: {
            description: 'Some error ocurred.',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/GetProposersResponse',
                },
                examples: {
                  object: {
                    value: {
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
                },
              },
            },
          },
        },
      },
    },
    /**
     * @description Deregister proposer path
     */
    '/proposer/de-register': {
      post: {
        summary: 'Deregister the Proposer',
        description:
          'This route will be responsible for deregister the proposer based on the address passed.',
        tags: ['Proposer'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeregisterProposerRequest',
              },
              examples: {
                updateProposerRequest: {
                  value: {
                    address: '0x0A2798E08B66A1a4188F4B239651C015aC587Bf8',
                  },
                },
              },
            },
          },
        },
        responses: {
          500: {
            description: 'Some error ocurred.',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/TxDataToSign',
                },
                examples: {
                  deregisterProposerResponse: {
                    value: {
                      txDataToSign: '0x9c0599ef',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    /**
     * @description Proposer withdraw path
     */
    '/proposer/withdrawStake': {
      post: {
        summary: 'Proposer withdraw stake',
        description:
          'This route will be responsible for make possible to a proposer to withdraw your stake.',
        tags: ['Proposer'],
        responses: {
          500: {
            description: 'Some error ocurred.',
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  $ref: '#/components/schemas/TxDataToSign',
                },
                examples: {
                  proposerWithdrawResponse: {
                    value: {
                      txDataToSign: '0xbed9d861',
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
      RegisterProposerRequest: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
          },
          stake: {
            type: 'number',
          },
          fee: {
            type: 'number',
          },
        },
      },
      TxDataToSign: {
        type: 'object',
        properties: {
          txDataToSign,
        },
      },
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
      CurrentProposerResponse: {
        type: 'object',
        properties: {
          currentProposer: {
            type: 'string',
          },
        },
      },
      GetProposersResponse: {
        type: 'object',
        properties: {
          proposer: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Proposer',
            },
          },
        },
      },
      Proposer: {
        type: 'object',
        properties: {
          0: {
            type: 'string',
          },
          1: {
            type: 'string',
          },
          2: {
            type: 'string',
          },
          3: {
            type: 'string',
          },
          4: {
            type: 'string',
          },
          5: {
            type: 'boolean',
          },
          6: {
            type: 'string',
          },
          thisAddress: {
            type: 'string',
          },
          previousAddress: {
            type: 'string',
          },
          nextAddress: {
            type: 'string',
          },
          url: {
            type: 'string',
          },
          fee: {
            type: 'string',
          },
          inProposerSet: {
            type: 'boolean',
          },
          indexProposerSet: {
            type: 'string',
          },
        },
      },
      DeregisterProposerRequest: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
          },
        },
      },
    },
  },
};

export { swaggerDocument };
