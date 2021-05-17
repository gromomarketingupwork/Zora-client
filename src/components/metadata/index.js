import React, { useState } from 'react';
import axios from 'axios';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { useWeb3React } from '@web3-react/core';

import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import { ClipLoader } from 'react-spinners';

import { BigNumber, ethers } from 'ethers';

import { FantomNFTConstants } from '../../constants/smartcontracts/fnft.constants';
import SCHandlers from '../../utils/sc.interaction';
import SystemConstants from '../../constants/system.constants';
import { useSelector } from 'react-redux';

import toast from 'utils/toast';
import WalletUtils from '../../utils/wallet';
import { calculateGasMargin } from 'utils';

const useStyles = makeStyles(() => ({
  container: {
    width: 400,
    height: 'fit-content',
    background: 'white',
    position: 'relative',
    marginTop: -40,
  },
  inkMetadataInput: {
    width: '100%',
    borderRadius: 5,
    backgroundColor: '#F6F6F6',
    padding: '0 22px 12px',
    marginBottom: 20,
  },
  inkMetadataInputLabel: {
    left: 22,
  },
  inkButton: {
    width: '60%',
    letterSpacing: 5,
    fontSize: 20,
    backgroundColor: '#007bff !important',
    color: '#fff !important',
    margin: '0 20% 24px',
    height: 48,
    cursor: 'pointer',

    '&:disabled': {
      color: '#fffa !important',
    },
  },
  autocomplete: {
    width: '100%',
    backgroundColor: '#ffffff !important',
    background: 'transparent !important',
  },

  mintStatusContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 'x-large',
    position: 'absolute',
    width: '100%',
  },
  nftIDLabel: {
    fontSize: 18,
    color: '#A5A5A5',
  },
  tnxAnchor: {
    textDecoration: 'unset',
    fontSize: 18,
    marginTop: '18px',
    color: '#007bff',
  },
  creteCollectionImageIcon: {
    width: 'unset !important',
    height: 'unset !important',
  },
  collectionLogoImage: {
    height: '100%',
    width: '100%',
    objectFit: 'contain',
  },
}));

const assetCategories = [
  'Art',
  'Domain Names',
  'Virtual Words',
  'Trading Cards',
  'Collectibles',
  'Sports',
  'Utility',
  'New',
];

const mintSteps = [
  'Uploading to IPFS',
  'Create your NFT',
  'Confirming the Transaction',
];

const Metadata = () => {
  const classes = useStyles();

  const { account, chainId } = useWeb3React();

  const [name, setName] = useState('fAsset');
  const [symbol, setSymbol] = useState('newnft');
  const [royalty, setRoyalty] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Art');

  const [currentMintingStep, setCurrentMintingStep] = useState(0);
  const [isMinting, setIsMinting] = useState(false);

  const [lastMintedTkId, setLastMintedTkId] = useState(0);
  const [lastMintedTnxId, setLastMintedTnxId] = useState('');

  let isWalletConnected = useSelector(state => state.ConnectWallet.isConnected);
  let authToken = useSelector(state => state.ConnectWallet.authToken);

  const handleInputChange = (value, target) => {
    switch (target) {
      case 'name':
        {
          setName(value);
        }
        break;
      case 'royalty':
        {
          setRoyalty(value);
        }
        break;
      case 'description':
        {
          setDescription(value);
        }
        break;
      case 'category':
        {
          setCategory(value);
        }
        break;
      case 'symbol':
        {
          setSymbol(value);
        }
        break;
      default: {
        console.log('default');
      }
    }
  };

  const validateMetadata = () => {
    return (
      name != '' &&
      symbol != '' &&
      royalty < 30 &&
      (category != '') & (account != '')
    );
  };

  const resetMintingStatus = () => {
    setTimeout(() => {
      setIsMinting(false);
      setCurrentMintingStep(0);
    }, 1000);
  };

  const mintNFT = async () => {
    if (!isWalletConnected) {
      toast('info', 'Connect your wallet first');
      return;
    }
    if (chainId != 250) {
      toast('info', 'You are not connected to Fantom Opera Network');
      return;
    }
    // only when the user has more than 1k ftms on the wallet
    let balance = await WalletUtils.checkBalance(account);

    if (balance < SystemConstants.FMT_BALANCE_LIMIT) {
      toast(
        'custom',
        `Your balance should be at least ${SystemConstants.FMT_BALANCE_LIMIT} ftm to mint an NFT`
      );
      return;
    }

    setLastMintedTkId(0);
    setLastMintedTnxId('');
    // show stepper
    setIsMinting(true);
    console.log('created from ', account);
    if (!validateMetadata()) {
      resetMintingStatus();
      return;
    }
    let canvas = document.getElementById('drawingboard');
    let formData = new FormData();
    formData.append('image', canvas.toDataURL());
    formData.append('name', name);
    formData.append('royalty', royalty);
    formData.append('account', account);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('symbol', symbol);
    try {
      let result = await axios({
        method: 'post',
        url: 'https://api1.artion.io/ipfs/uploadImage2Server',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + authToken,
        },
      });

      console.log('upload image result is ');
      console.log(result);

      const jsonHash = result.data.jsonHash;

      let fnft_sc = await SCHandlers.loadContract(
        FantomNFTConstants.MAINNETADDRESS,
        FantomNFTConstants.ABI
      );

      const provider = fnft_sc[1];
      fnft_sc = fnft_sc[0];

      try {
        const args = [account, jsonHash];
        const options = {
          value: ethers.utils.parseEther('2'),
        };
        const gasEstimate = await fnft_sc.estimateGas.mint(...args, options);
        options.gasLimit = calculateGasMargin(gasEstimate);
        let tx = await fnft_sc.mint(...args, options);
        setCurrentMintingStep(1);
        setLastMintedTnxId(tx.hash);

        setCurrentMintingStep(2);
        const confirmedTnx = await provider.waitForTransaction(tx.hash);
        setCurrentMintingStep(3);
        let evtCaught = confirmedTnx.logs[0].topics;
        let mintedTkId = BigNumber.from(evtCaught[3]);
        setLastMintedTkId(mintedTkId.toNumber());
      } catch (error) {
        toast('error', error.message);
      }
    } catch (error) {
      toast('error', error.message);
    }
    resetMintingStatus();
  };

  return (
    <div className={classes.container}>
      <div>
        <TextField
          className={classes.inkMetadataInput}
          InputLabelProps={{
            className: classes.inkMetadataInputLabel,
          }}
          label="Name"
          value={name}
          onChange={e => {
            handleInputChange(e.target.value, 'name');
          }}
        />
        <TextField
          className={classes.inkMetadataInput}
          InputLabelProps={{
            className: classes.inkMetadataInputLabel,
          }}
          label="Symbol"
          value={symbol}
          onChange={e => {
            handleInputChange(e.target.value, 'symbol');
          }}
        />
        <TextField
          className={classes.inkMetadataInput}
          InputLabelProps={{
            className: classes.inkMetadataInputLabel,
          }}
          label="Royalties (%)"
          type="number"
          value={royalty}
          onChange={e => {
            handleInputChange(e.target.value, 'royalty');
          }}
          InputProps={{
            inputProps: {
              min: 1,
            },
          }}
        />
        <Autocomplete
          options={assetCategories}
          getOptionLabel={option => {
            handleInputChange(option, 'category');
            return option;
          }}
          value={category}
          className={classes.autocomplete}
          renderInput={params => (
            <TextField
              {...params}
              className={classes.inkMetadataInput}
              InputLabelProps={{
                className: classes.inkMetadataInputLabel,
              }}
              label="Category"
            />
          )}
        />
        <TextField
          className={classes.inkMetadataInput}
          InputLabelProps={{
            className: classes.inkMetadataInputLabel,
          }}
          label="Description(Optional)"
          style={{ textAlign: 'left' }}
          hinttext="Message Field"
          defaultValue={description}
          floatinglabeltext="MultiLine and FloatingLabel"
          multiline
          rows={4}
          onChange={e => {
            handleInputChange(e.target.value, 'description');
          }}
        />

        {isMinting && (
          <div>
            <Stepper activeStep={currentMintingStep} alternativeLabel>
              {mintSteps.map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </div>
        )}
        <Button
          variant="contained"
          color="primary"
          className={classes.inkButton}
          onClick={mintNFT}
          disabled={isMinting || !isWalletConnected}
        >
          {isMinting ? (
            <ClipLoader size="16" color="white"></ClipLoader>
          ) : (
            'MINT'
          )}
        </Button>
      </div>
      <div className={classes.mintStatusContainer}>
        {lastMintedTkId !== 0 && (
          <label className={classes.nftIDLabel}>
            You have created an NFT with ID of {lastMintedTkId}
          </label>
        )}

        {lastMintedTnxId !== '' && (
          <a
            className={classes.tnxAnchor}
            target="_blank"
            rel="noopener noreferrer"
            href={`https://ftmscan.com/tx/${lastMintedTnxId}`}
          >
            You can track the last transaction here ...
          </a>
        )}
      </div>
    </div>
  );
};

export default Metadata;
