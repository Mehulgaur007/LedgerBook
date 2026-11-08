; Pawn Ledger – the Windows uninstaller only runs after the owner approved it inside the app
; (Owner / Admin -> today's admin code -> Uninstall). The app writes the flag file below just before
; starting the uninstaller. Normal updates (installing a newer version over this one) are allowed.
!macro customUnInit
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${If} ${Errors}
    IfFileExists "$APPDATA\PawnLedger\allow-uninstall.flag" pl_uninstall_ok 0
      MessageBox MB_OK|MB_ICONSTOP "Pawn Ledger can only be uninstalled by the owner.$\r$\n$\r$\nOpen Pawn Ledger, click Owner / Admin on the login screen, enter today's admin code and choose Uninstall."
      Quit
    pl_uninstall_ok:
  ${EndIf}
!macroend

!macro customUnInstall
  ; remove the licence and encrypted data folder after an owner-approved uninstall
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${If} ${Errors}
    RMDir /r "$APPDATA\PawnLedger"
  ${EndIf}
!macroend
