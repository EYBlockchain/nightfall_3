/* ignore unused exports */
import { settingsActionTypes } from './settings.actions';

const initialState = {
  mnemonicBackupEnable: false,
};

function settingsReducer(state = initialState, action) {
  switch (action.type) {
    case settingsActionTypes.SETTINGS_BACKUP_MNEMONIC_ENABLE:
      return {
        ...state,
        mnemonicBackupEnable: action.payload.flag,
      };

    default:
      return state;
  }
}

export default settingsReducer;
