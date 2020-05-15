# Automated Testnet Faucet

### Usage

#### From the GUI

* visit <https://csb-k2nzi.netlify.app/>
* enter your evonet address in the field
* click "Request funds"

#### In your app

* send a GET request to `https://qetrgbsx30.execute-api.us-west-1.amazonaws.com/stage/?dashAddress=${yourAddress}`

### Notes

* There's a rate limit per IP address of 200 eDASH for any given 15 minutes period.
