[
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name_",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol_",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "preRevealURI_",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "maxSupply_",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "creator_",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "pathUSD_",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "feeRecipient_",
				"type": "address"
			},
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "minterFeeBps",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "creatorFeeBps",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "perMintFlatFee",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "royaltyBps",
						"type": "uint256"
					}
				],
				"internalType": "struct CollectionFeeConfig",
				"name": "fees_",
				"type": "tuple"
			}
		],
		"name": "initialize",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]