import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import styles from '../../styles/sidebar/sideItem.module.scss';

export default function SideItem({ text, link, Icon }) {
  return (
    <Link to={link}>
      <div className={window.location.pathname !== link ? styles.itemInactive : styles.itemActive}>
        <Icon size={24} />
        <div className={styles.itemText}>{text}</div>
      </div>
    </Link>
  );
}

SideItem.propTypes = {
  text: PropTypes.element.isRequired,
  link: PropTypes.element.isRequired,
  Icon: PropTypes.element.isRequired,
};
