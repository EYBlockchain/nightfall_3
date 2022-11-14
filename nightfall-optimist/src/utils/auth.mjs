import passport from 'passport';

export default passport.authenticate('header', { session: false });
