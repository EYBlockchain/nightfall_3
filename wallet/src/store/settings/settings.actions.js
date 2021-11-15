/* ignore unused exports */
export const settingsActionTypes = {
  SETTINGS_BACKUP_MNEMONIC_ENABLE: 'SETTINGS_BACKUP_MNEMONIC_ENABLE',
};

export function mnemonicBackupEnable(flag) {
  return {
    type: settingsActionTypes.SETTINGS_BACKUP_MNEMONIC_ENABLE,
    payload: { flag },
  };
}
