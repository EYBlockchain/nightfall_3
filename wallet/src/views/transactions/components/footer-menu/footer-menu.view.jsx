import React from 'react';
import { Menu, Icon, Container, Header } from 'semantic-ui-react';
import { Link } from 'react-router-dom';

function FooterMenu() {
  /*
  const rNumber = Math.floor(Math.random() * 2);
  const rColor = rNumber === 0 ? 'green' : 'red';
  const rIcon = rNumber === 0 ? 'thumbs up' : 'thumbs down';
  */
  const rColor = 'grey';
  const rIcon = 'thumbs up';
  return (
    <Container textAlign="center">
      <Header
        as="h1"
        style={{
          fontSize: '4em',
          fontWeight: 'normal',
          marginBottom: 0,
          marginTop: '1em',
        }}
      />
      <Menu secondary>
        <Menu.Menu position="left">
          <Link to="/login">
            <Menu.Item name="footerMenu" disabled>
              <Icon name={`${rIcon}`} size="large" color={`${rColor}`} />
              Status
            </Menu.Item>
          </Link>
          <Link to="/account-info">
            <Menu.Item name="footerMenu" disabled>
              <Icon name="play" size="large" />
              Wallet Version
            </Menu.Item>
          </Link>
          <Link to="/issues">
            <Menu.Item name="footerMenu">
              <Icon name="ambulance" size="large" />
              Report an Issue
            </Menu.Item>
          </Link>
        </Menu.Menu>
      </Menu>
    </Container>
  );
}

export default FooterMenu;
