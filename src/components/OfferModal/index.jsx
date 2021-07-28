import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import { ClipLoader } from 'react-spinners';

import { formatNumber } from 'utils';
import { FTM_TOTAL_SUPPLY } from 'constants/index';

import Modal from '../Modal';
import styles from '../Modal/common.module.scss';

const OfferModal = ({
  visible,
  onClose,
  onMakeOffer,
  confirming,
  totalSupply,
}) => {
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [endTime, setEndTime] = useState(
    new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
  );

  const { price: ftmPrice } = useSelector(state => state.Price);

  useEffect(() => {
    setPrice('');
    setQuantity('1');
    setEndTime(new Date(new Date().getTime() + 24 * 60 * 60 * 1000));
  }, [visible]);

  const handleQuantityChange = e => {
    const val = e.target.value;
    if (!val) {
      setQuantity('');
      return;
    }

    if (isNaN(val)) return;

    const _quantity = parseInt(val);
    setQuantity(Math.min(_quantity, totalSupply));
  };

  const handleMakeOffer = () => {
    let quant = 1;
    if (totalSupply > 1) {
      quant = parseInt(quantity);
    }
    onMakeOffer(price, quant, endTime);
  };

  const validateInput = () => {
    if (price.length === 0) return false;
    if (totalSupply > 1 && quantity.length === 0) return false;
    if (endTime.getTime() < new Date().getTime()) return false;
    return true;
  };

  return (
    <Modal
      visible={visible}
      title="Place your offer"
      submitDisabled={confirming || !validateInput()}
      submitLabel={
        confirming ? <ClipLoader color="#FFF" size={16} /> : 'Place Offer'
      }
      onSubmit={() =>
        !confirming && validateInput() ? handleMakeOffer() : null
      }
      cancelDisabled={confirming}
      onCancel={!confirming ? onClose : null}
    >
      <div className={styles.formGroup}>
        <div className={styles.formLabel}>Price (wFTM)</div>
        <div className={styles.formInputCont}>
          <input
            className={styles.formInput}
            placeholder="0.00"
            value={price}
            onChange={e =>
              setPrice(
                isNaN(e.target.value)
                  ? price
                  : Math.min(e.target.value, FTM_TOTAL_SUPPLY).toString()
              )
            }
            disabled={confirming}
          />
          <div className={styles.usdPrice}>
            ${formatNumber(((parseFloat(price) || 0) * ftmPrice).toFixed(2))}
          </div>
        </div>
      </div>
      {totalSupply !== null && (
        <div className={styles.formGroup}>
          <div className={styles.formLabel}>Quantity</div>
          <div className={styles.formInputCont}>
            <input
              className={styles.formInput}
              placeholder={totalSupply}
              value={quantity}
              onChange={handleQuantityChange}
              disabled={confirming || totalSupply === 1}
            />
          </div>
        </div>
      )}
      <div className={styles.formGroup}>
        <div className={styles.formLabel}>Offer Expiration</div>
        <div className={styles.formInputCont}>
          <Datetime
            value={endTime}
            onChange={val => setEndTime(val.toDate())}
            inputProps={{
              className: styles.formInput,
              onKeyDown: e => e.preventDefault(),
              disabled: confirming,
            }}
            closeOnSelect
            isValidDate={cur =>
              cur.valueOf() > new Date().getTime() - 1000 * 60 * 60 * 24
            }
          />
        </div>
      </div>
    </Modal>
  );
};

export default OfferModal;
