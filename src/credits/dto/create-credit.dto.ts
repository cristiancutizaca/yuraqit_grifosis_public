export class CreateCreditDto {
  client_id: number;
  sale_id: number;
  credit_amount: number;
  amount_paid?: number;    // Opcional porque puedes poner 0 por defecto
  due_date: string;        // O Date si así lo manejas en tu frontend
  status?: string;         // Opcional
}
