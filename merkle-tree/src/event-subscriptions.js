/**
@author MichaelConnorOfficial
*/

import config from 'config';
import jsonfile from 'jsonfile';

import utils from './utils';
import utilsWeb3 from './utils-web3';

let Arbiter
let TokenShield

//global event name variables, to help us unsubscribe at times:
let transferSubscription = {};
let joinSubscription = {};
let splitSubscription = {};

let claimSubmittedSubscription = {};
let claimAcceptedSubscription = {};
let claimRejectedSubscription = {};

//we wrap this in a setter function, because we need to copy the Contracts' build folders from the zkp microservice first
function setContracts() {
  Arbiter = contract(jsonfile.readFileSync('./build/contracts/Arbiter.json'))
  Arbiter.setProvider(web3.currentProvider)
  Arbiter.currentProvider.sendAsync = function() {
    return Arbiter.currentProvider.send.apply(Arbiter.currentProvider,  arguments);
  };

  TokenShield = contract(jsonfile.readFileSync('./build/contracts/TokenShield.json'))
  TokenShield.setProvider(web3.currentProvider)
  TokenShield.currentProvider.sendAsync = function() {
    return TokenShield.currentProvider.send.apply(TokenShield.currentProvider,  arguments);
  };
}

//{authorization}  allows us to access the api-gateway
//{name}  gives us a global storage slot for the user's subscriptions
async function subscribeToTokenShield({ authorization, name }) {
    console.log("\narbitration/src/event-subscriptions.js", "subscribeToTokenShield", "name:", name)
    // console.log("authorization:", authorization)

    setContracts()
    tokenShield = await TokenShield.deployed()

    console.log(name + "'s subscriptions before:")
    console.log(transferSubscription[name])
    console.log(joinSubscription[name])
    console.log(splitSubscription[name])

    // only subscribe if not already subscribed:
    if (transferSubscription[name] === undefined) {
      transferSubscription[name] = await utilsWeb3.subscribeToEvent('TokenShield', tokenShield.address, 'Transfer', transferResponder, authorization, name)
    }

    if (joinSubscription[name] === undefined) {
      joinSubscription[name] = await utilsWeb3.subscribeToEvent('TokenShield', tokenShield.address, 'Join', joinResponder, authorization, name)
    }

    if (splitSubscription[name] === undefined) {
      splitSubscription[name] = await utilsWeb3.subscribeToEvent('TokenShield', tokenShield.address, 'Split', splitResponder, authorization, name)
    }

    console.log(name + "'s subscriptions after:")
    console.log(transferSubscription[name])
    console.log(joinSubscription[name])
    console.log(splitSubscription[name])
}


async function unsubscribeFromTokenShield({ name }) {
    console.log("\narbitration/src/event-subscriptions.js", "unsubscribeFromTokenShield")
    // console.log("name:", name)

    await utilsWeb3.unsubscribeFromEvent(transferSubscription[name])
    transferSubscription[name] = undefined;

    await utilsWeb3.unsubscribeFromEvent(joinSubscription[name])
    joinSubscription[name] = undefined;

    await utilsWeb3.unsubscribeFromEvent(splitSubscription[name])
    splitSubscription[name] = undefined;
}


//{authorization}  allows us to access the api-gateway
async function subscribeToArbiter({ authorization, name }) {
    console.log("\narbitration/src/event-subscriptions.js", "subscribeToArbiter")
    console.log("I am", name, "subscribing to Arbiter events...")
    // console.log("authorization:", authorization)

    setContracts()
    arbiter = await Arbiter.deployed()

    if (claimAcceptedSubscription[name] === undefined) {
      claimAcceptedSubscription[name] = await utilsWeb3.subscribeToEvent('Arbiter', arbiter.address, 'ClaimAccepted', claimAcceptedResponder, authorization, name)
    }

    if (claimRejectedSubscription[name] === undefined) {
      claimRejectedSubscription[name] = await utilsWeb3.subscribeToEvent('Arbiter', arbiter.address, 'ClaimRejected', claimRejectedResponder, authorization, name)
    }

    // console.log(claimAcceptedSubscription)
    // console.log(claimRejectedSubscription)
}


//{authorization} allows us to access the api-gateway
async function subscribeAsArbitrator({ authorization }) {
    console.log("\narbitration/src/event-subscriptions.js", "subscribeAsArbitrator")
    console.log("I am an Arbitrator subscribing to Arbiter events...")
    // console.log("authorization:", authorization)

    setContracts()
    arbiter = await Arbiter.deployed()

    utilsWeb3.subscribeToEvent('Arbiter', arbiter.address, 'ClaimSubmitted', claimSubmittedResponder, authorization, 'Arbitrator')
    //
    // utilsWeb3.subscribeToEvent('Arbiter', arbiter.address, 'FakeReported', fakeReportedResponder)

}



//RESPONDER CALLBACKS:
let claimSubmittedResponder = async function(eventObject, authorization) {
    console.log("\nCLAIM SUBMITTED RESPONDER TRIGGERED!!!")
    await api_gateway.incomingClaimSubmittedToken({authorization: authorization}, eventObject)
}
let claimAcceptedResponder = async function(eventObject, authorization) {
    console.log("\nCLAIM ACCEPTED RESPONDER TRIGGERED!!!")
    await api_gateway.incomingClaimAcceptedToken({authorization: authorization}, eventObject)
}
let claimRejectedResponder = async function(eventObject, authorization) {
    console.log("\nCLAIM REJECTED RESPONDER TRIGGERED!!!")
    await api_gateway.incomingClaimRejectedToken({authorization: authorization}, eventObject)
}


let transferResponder = async function(eventObject, authorization) {
    console.log("\nTRANSFER RESPONDER TRIGGERED!!!")
    let nullifier = [];
    nullifier[0] = eventObject.decodedEventData.nullifier
    await api_gateway.checkNullifier({authorization: authorization}, {nullifier})
}
let joinResponder = async function(eventObject, authorization) {
    console.log("\nJOIN RESPONDER TRIGGERED!!!")
    let nullifier = [];
    nullifier[0] = eventObject.decodedEventData.nullifier1
    nullifier[1] = eventObject.decodedEventData.nullifier2
    await api_gateway.checkNullifier({authorization: authorization}, {nullifier})
}
let splitResponder = async function(eventObject, authorization) {
    console.log("\nSPLIT RESPONDER TRIGGERED!!!")
    let nullifier = [];
    nullifier[0] = eventObject.decodedEventData.nullifier
    await api_gateway.checkNullifier({authorization: authorization}, {nullifier})
}


module.exports = {
  subscribeToTokenShield,
  unsubscribeFromTokenShield,
  subscribeToArbiter,
  subscribeAsArbitrator
}
