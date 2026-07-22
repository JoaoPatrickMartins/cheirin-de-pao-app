/**
 * Saudação conforme o horário do dispositivo. Fonte ÚNICA — importe daqui em vez
 * de redeclarar a função em cada tela (login, home do cliente, tela do entregador).
 */
export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
