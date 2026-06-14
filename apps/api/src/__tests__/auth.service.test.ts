// Auth service test stubs — implementation in Plan 02-02
// Requirements: AUTH-05 (OTP generation), AUTH-06 (session management)

describe('AuthService [AUTH-05, AUTH-06]', () => {
  it.todo('generateOtpCode returns 4-digit string between 1000 and 9999')
  it.todo('dev mode OTP_DEV_CODE=1234 accepted')
  it.todo('session expiresAt < now returns 401')
  it.todo('device mismatch revokes session')
})
