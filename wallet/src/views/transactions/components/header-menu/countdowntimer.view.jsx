import React from 'react';
import PropTypes from 'prop-types';

const CountDownTimer = ({ timestamp }) => {
  function toDaysHoursMinutesSeconds(ts) {
    const days = Math.floor(ts / (24 * 3600));
    const hours = Math.floor((ts - days * 24 * 3600) / 3600);
    const minutes = Math.floor((ts - days * 24 * 3600 - hours * 3600) / 60);
    const seconds = Math.floor(ts - days * 24 * 3600 - hours * 3600 - minutes * 60);
    return [days, hours, minutes, seconds];
  }
  const daysHoursMinutesSeconds = toDaysHoursMinutesSeconds(timestamp);
  const [[ds, hrs, mins, secs], setTime] = React.useState(daysHoursMinutesSeconds);

  const reset = () => setTime([0, 0, 0, 0]);

  const tick = () => {
    if (ds === 0 && hrs === 0 && mins === 0 && secs === 0) reset();
    else if (hrs === 0 && mins === 0 && secs === 0) {
      setTime([ds - 1, 23, 59, 59]);
    } else if (mins === 0 && secs === 0) {
      setTime([ds, hrs - 1, 59, 59]);
    } else if (secs === 0) {
      setTime([ds, hrs, mins - 1, 59]);
    } else {
      setTime([ds, hrs, mins, secs - 1]);
    }
  };

  React.useEffect(() => {
    const timerId = setInterval(() => tick(), 1000);
    return () => clearInterval(timerId);
  });

  return (
    <div>
      <p>{`${ds.toString().padStart(1, '0')} days ${hrs.toString().padStart(2, '0')} hours ${mins
        .toString()
        .padStart(2, '0')} minutes ${secs.toString().padStart(2, '0')} seconds`}</p>
    </div>
  );
};

CountDownTimer.propTypes = {
  timestamp: PropTypes.number.isRequired,
};

export default CountDownTimer;
