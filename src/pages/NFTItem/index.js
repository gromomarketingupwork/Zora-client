import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Chart } from 'react-charts';
import axios from 'axios';
import { ethers } from 'ethers';

import Panel from '../../components/Panel';
import ResizableBox from '../../components/ResizableBox';
import { fetchTokenURI, increaseViewCount, getOffers } from '../../api';
import {
  getSalesContract,
  getNFTContract,
  getListing,
  listItem,
  cancelListing,
  updateListing,
  buyItem,
  getWFTMBalance,
  wrapFTM,
  createOffer,
  cancelOffer,
  acceptOffer,
  SALES_CONTRACT_ADDRESS,
  WFTM_ADDRESS,
} from 'contracts';
import { abbrAddress } from 'utils';
import SellModal from 'components/SellModal';
import OfferModal from 'components/OfferModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';

import styles from './styles.module.scss';

const NFTItem = () => {
  const { addr: address, id: tokenID } = useParams();

  const [info, setInfo] = useState();
  const [owner, setOwner] = useState();
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [listing, setListing] = useState(null);
  const [offers, setOffers] = useState([]);
  const [views, setViews] = useState();

  const collections = useSelector(state => state.Collections);
  const myAddress = useSelector(state => state.ConnectWallet.address);

  const collection = collections.find(col => col.address === address);

  const getTokenURI = async () => {
    try {
      const { data: tokenURI } = await fetchTokenURI(address, tokenID);
      const { data } = await axios.get(tokenURI);
      setInfo(data);
    } catch {
      console.log('Token URI not available');
    }
  };

  const getTokenOwner = async () => {
    try {
      const [contract] = await getNFTContract(address);
      const res = await contract.ownerOf(tokenID);
      setOwner(res);
    } catch {
      setOwner(null);
    }
  };

  const getItemListings = async () => {
    try {
      const listing = await getListing(address, tokenID);
      setListing(listing);
    } catch (e) {
      console.log(e);
    }
  };

  const getCurrentOffers = async () => {
    try {
      const { data } = await getOffers(address, tokenID);
      setOffers(data);
    } catch (e) {
      console.log(e);
    }
  };

  const eventMatches = (nft, id) => {
    return (
      address.toLowerCase() === nft.toLowerCase() &&
      parseFloat(tokenID) === parseFloat(id.toString())
    );
  };

  const addEventListeners = async () => {
    const contract = await getSalesContract();

    contract.on(
      'ItemListed',
      (
        owner,
        nft,
        id,
        quantity,
        pricePerItem,
        startingTime,
        isPrivate,
        allowedAddress
      ) => {
        if (eventMatches(nft, id)) {
          setListing({
            owner,
            quantity: parseFloat(quantity.toString()),
            pricePerItem: parseFloat(pricePerItem.toString()) / 10 ** 18,
            startingTime: parseFloat(startingTime.toString()),
            allowedAddress,
          });
        }
      }
    );

    contract.on('ItemUpdated', (owner, nft, id, newPrice) => {
      if (eventMatches(nft, id)) {
        const newListing = {
          ...listing,
          pricePerItem: parseFloat(newPrice.toString()) / 10 ** 18,
        };
        setListing(newListing);
      }
    });

    contract.on('ItemCanceled', (owner, nft, id) => {
      if (eventMatches(nft, id)) {
        setListing(null);
      }
    });

    contract.on('ItemSold', (seller, buyer, nft, id) => {
      if (eventMatches(nft, id)) {
        setListing(null);
      }
    });

    contract.on(
      'OfferCreated',
      (creator, nft, id, payToken, quantity, pricePerItem, deadline) => {
        if (eventMatches(nft, id)) {
          const newOffers = [...offers];
          newOffers.push({
            creator,
            deadline: parseFloat(deadline.toString()),
            payToken,
            pricePerItem: parseFloat(pricePerItem.toString()) / 10 ** 18,
            quantity: parseFloat(quantity.toString()),
          });
          setOffers(newOffers);
        }
      }
    );

    contract.on('OfferCanceled', (creator, nft, id) => {
      if (eventMatches(nft, id)) {
        const newOffers = offers.filter(
          offer => offer.creator.toLowerCase() === creator.toLowerCase()
        );
        setOffers(newOffers);
      }
    });
  };

  useEffect(() => {
    addEventListeners();
  }, []);

  useEffect(() => {
    getTokenURI();
    getTokenOwner();
    getItemListings();
    getCurrentOffers();

    increaseViewCount(address, tokenID).then(({ data }) => {
      setViews(data);
    });
  }, [address, tokenID]);

  const isMine = owner === myAddress;

  const handleListItem = async _price => {
    try {
      const [contract, provider] = await getNFTContract(address);
      const approved = await contract.isApprovedForAll(
        myAddress,
        SALES_CONTRACT_ADDRESS
      );

      if (!approved) {
        const approveTx = await contract.setApprovalForAll(
          SALES_CONTRACT_ADDRESS,
          true
        );
        await provider.waitForTransaction(approveTx.hash);
      }

      const price = ethers.utils.parseEther(_price);
      const tx = await listItem(
        address,
        ethers.BigNumber.from(tokenID),
        ethers.BigNumber.from(1),
        price,
        ethers.BigNumber.from(Math.floor(new Date().getTime() / 1000)),
        '0x0000000000000000000000000000000000000000'
      );

      setSellModalVisible(false);

      await provider.waitForTransaction(tx.hash);
    } catch (e) {
      console.log('Error while listing item', e);
    }
  };

  const handleUpdatePrice = async _price => {
    try {
      const price = ethers.utils.parseEther(_price);
      const tx = await updateListing(address, tokenID, price);

      setSellModalVisible(false);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.waitForTransaction(tx.hash);
    } catch (e) {
      console.log('Error while updating listing price', e);
    }
  };

  const cancelList = async () => {
    await cancelListing(address, tokenID);
    setListing(null);
  };

  const handleBuyItem = async _price => {
    const [contract, provider] = await getNFTContract(address);
    const approved = await contract.isApprovedForAll(
      myAddress,
      SALES_CONTRACT_ADDRESS
    );

    if (!approved) {
      const approveTx = await contract.setApprovalForAll(
        SALES_CONTRACT_ADDRESS,
        true
      );
      await provider.waitForTransaction(approveTx.hash);
    }

    const price = ethers.utils.parseEther(_price.toString());
    const tx = await buyItem(
      address,
      ethers.BigNumber.from(tokenID),
      price,
      myAddress
    );
    await provider.waitForTransaction(tx.hash);
  };

  const handleMakeOffer = async (_price, endTime) => {
    const [contract, provider] = await getNFTContract(address);
    const approved = await contract.isApprovedForAll(
      myAddress,
      SALES_CONTRACT_ADDRESS
    );

    if (!approved) {
      const approveTx = await contract.setApprovalForAll(
        SALES_CONTRACT_ADDRESS,
        true
      );
      await provider.waitForTransaction(approveTx.hash);
    }

    const price = ethers.utils.parseEther(_price.toString());
    const deadline = Math.floor(endTime.getTime() / 1000);

    const balance = await getWFTMBalance(myAddress);

    if (balance.lt(price)) {
      await wrapFTM(price, myAddress);
    }

    const tx = await createOffer(
      address,
      ethers.BigNumber.from(tokenID),
      WFTM_ADDRESS,
      ethers.BigNumber.from(1),
      price,
      ethers.BigNumber.from(deadline)
    );

    setOfferModalVisible(false);

    await provider.waitForTransaction(tx.hash);
  };

  const handleAcceptOffer = async creator => {
    const tx = await acceptOffer(address, tokenID, creator);

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.waitForTransaction(tx.hash);
  };

  const handleCancelOffer = async () => {
    const tx = await cancelOffer(address, tokenID);

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.waitForTransaction(tx.hash);
  };

  const hasMyOffer = useMemo(() => {
    return offers.findIndex(offer => offer.creator === myAddress) > -1;
  }, [offers]);

  const series = useMemo(
    () => ({
      showPoints: false,
    }),
    []
  );

  const axes = useMemo(
    () => [
      {
        primary: true,
        type: 'time',
        position: 'bottom',
        show: [true, false],
      },
      { type: 'linear', position: 'left' },
    ],
    []
  );

  const startDate = new Date();
  const data = Array.from(Array(10), (_, i) => ({
    primary: new Date(startDate.getTime() + 60 * 1000 * 60 * 24 * i),
    // primary: i,
    secondary: Math.floor(Math.random() * 30),
    radius: undefined,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {isMine ? (
          <>
            {listing ? (
              <div className={styles.headerButton} onClick={cancelList}>
                Cancel Listing
              </div>
            ) : null}
            <div
              className={styles.headerButton}
              onClick={() => setSellModalVisible(true)}
            >
              {listing ? 'Update Listing' : 'Sell'}
            </div>
          </>
        ) : (
          <>
            <div
              className={styles.headerButton}
              onClick={
                hasMyOffer
                  ? handleCancelOffer
                  : () => setOfferModalVisible(true)
              }
            >
              {hasMyOffer ? 'Cancel Offer' : 'Make Offer'}
            </div>
          </>
        )}
      </div>
      <div className={styles.inner}>
        <div className={styles.topContainer}>
          <div className={styles.itemSummary}>
            <div className={styles.itemMedia}>
              <img src={info?.image} />
            </div>
            <div className={styles.itemInfoCont}>
              {info?.properties && (
                <Panel title="Properties">
                  <div className={styles.fakeBody} />
                </Panel>
              )}
              <Panel
                title={`About ${collection?.collectionName ||
                  collection?.name}`}
              >
                <div className={styles.panelBody}>
                  {collection?.description || 'Unverified Collection'}
                </div>
              </Panel>
              <Panel title="Chain Info">
                <div className={styles.panelBody}>
                  <div className={styles.panelLine}>
                    <div className={styles.panelLabel}>Collection</div>
                    <a
                      href={`https://ftmscan.com/token/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.panelValue}
                    >
                      {abbrAddress(address)}
                    </a>
                  </div>
                  <div className={styles.panelLine}>
                    <div className={styles.panelLabel}>Network</div>
                    <div className={styles.panelValue}>Fantom Opera</div>
                  </div>
                  <div className={styles.panelLine}>
                    <div className={styles.panelLabel}>Chain ID</div>
                    <div className={styles.panelValue}>250</div>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
          <div className={styles.itemMain}>
            <div className={styles.wrapper}>
              <div className={styles.itemCategory}>
                {collection?.name || ''}
              </div>
              <div className={styles.itemName}>{info?.name || ''}</div>
              <div className={styles.itemViews}>
                <FontAwesomeIcon icon={faEye} color="#777" />
                &nbsp;{views} Views
              </div>
            </div>
            <div className={styles.panelWrapper}>
              <Panel title="Price History">
                <div className={styles.chartWrapper}>
                  <ResizableBox width="100%" height={250} resizable={false}>
                    <Chart
                      data={[{ label: 'Price', data }]}
                      series={series}
                      axes={axes}
                      tooltip
                    />
                  </ResizableBox>
                </div>
              </Panel>
            </div>
            <div className={styles.panelWrapper}>
              <Panel title="Listings">
                <div className={styles.listings}>
                  {listing && (
                    <div className={styles.listing}>
                      <div className={styles.owner}>
                        {abbrAddress(listing.owner)}
                      </div>
                      <div className={styles.price}>
                        {listing.pricePerItem} FTM
                      </div>
                      {!isMine && (
                        <div
                          className={styles.buyButton}
                          onClick={() => handleBuyItem(listing.pricePerItem)}
                        >
                          Buy
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            </div>
            <div className={styles.panelWrapper}>
              <Panel title="Offers">
                <div className={styles.offers}>
                  {offers.map((offer, idx) => (
                    <div className={styles.offer} key={idx}>
                      <div className={styles.owner}>
                        {abbrAddress(offer.creator)}
                      </div>
                      <div className={styles.price}>
                        {offer.pricePerItem} FTM
                      </div>
                      {isMine && (
                        <div
                          className={styles.buyButton}
                          onClick={() => handleAcceptOffer(offer.creator)}
                        >
                          Accept
                        </div>
                      )}
                      {offer.creator === myAddress && (
                        <div
                          className={styles.buyButton}
                          onClick={() => handleCancelOffer()}
                        >
                          Withdraw
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
        <div className={styles.panelWrapper}>
          <Panel title="Trade History">
            <div className={styles.fakeBody} />
          </Panel>
        </div>
      </div>

      <SellModal
        visible={sellModalVisible}
        onClose={() => setSellModalVisible(false)}
        onSell={listing ? handleUpdatePrice : handleListItem}
        startPrice={listing?.pricePerItem || 0}
      />
      <OfferModal
        visible={offerModalVisible}
        onClose={() => setOfferModalVisible(false)}
        onMakeOffer={handleMakeOffer}
      />
    </div>
  );
};

export default NFTItem;
