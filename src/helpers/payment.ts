// src/helpers/payment.ts

/**
 * Төлбөрийн validation үр дүн
 */
export interface PaymentValidation {
  valid: boolean;
  totalPaid: number;
  difference: number;
  message?: string;
}

/**
 * Төлбөрийн мэдээлэл (interface)
 */
export interface PaymentInput {
  code: string;
  status: string;
  paidAmount: number;
}

/**
 * Төлбөр шалгах
 *
 * - PAID статустай төлбөрүүдийн нийлбэр = totalAmount эсэх
 *
 * @param payments - Төлбөрийн жагсаалт
 * @param totalAmount - Нийт дүн
 */
export function validatePayments(
  payments: PaymentInput[],
  totalAmount: number,
): PaymentValidation {
  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    return {
      valid: false,
      totalPaid: 0,
      difference: totalAmount,
      message: "Төлбөрийн мэдээлэл хоосон байна",
    };
  }

  // PAID статустай төлбөрүүдийн нийлбэр
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + (p.paidAmount || 0), 0);

  const difference = Math.round((totalAmount - totalPaid) * 100) / 100;

  if (Math.abs(difference) > 0.01) {
    return {
      valid: false,
      totalPaid,
      difference,
      message: `Төлбөр таарахгүй байна: Нийт дүн ${totalAmount}, Төлсөн ${totalPaid}, Зөрүү ${difference}`,
    };
  }

  return {
    valid: true,
    totalPaid,
    difference: 0,
  };
}

/**
 * Төлбөрийн код шалгах
 */
export function isValidPaymentCode(code: string): boolean {
  const validCodes = [
    "CASH",
    "PAYMENT_CARD",
    "BONUS_CARD_TEST",
    "EMD",
    "BANK_TRANSFER",
  ];
  return validCodes.includes(code);
}

/**
 * Төлбөрийн статус шалгах
 */
export function isValidPaymentStatus(status: string): boolean {
  const validStatuses = ["PAID", "PAY", "REVERSED", "ERROR"];
  return validStatuses.includes(status);
}
