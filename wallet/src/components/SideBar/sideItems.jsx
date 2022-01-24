import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import styles from '../../styles/sidebar/sideItem.module.scss';

export default function SideItem({ text, link }) {
  return (
    <Link to={link}>
      <div className={styles.item}>{text}</div>
    </Link>
  );
}

SideItem.propTypes = {
  text: PropTypes.element.isRequired,
  link: PropTypes.element.isRequired,
};
