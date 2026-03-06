import fetch from 'node-fetch';
import logger from '../utils/logger';

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

type NpResponse<T = unknown> = {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
};

export async function npPost<T = unknown>(
  modelName: string,
  calledMethod: string,
  methodProperties: object,
  apiKey: string,
): Promise<NpResponse<T>> {
  const response = await fetch(NP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  });
  return response.json() as Promise<NpResponse<T>>;
}

// NP StatusCode → CRM status mapping
// 9 = Вручено, 14 = Прибув на склад (відділення) → DELIVERED
// 10 = Повернення ініційовано, 11 = Відмова отримувача → RETURNED
const NP_STATUS_MAP: Record<string, 'DELIVERED' | 'RETURNED' | null> = {
  '9': 'DELIVERED',
  '14': 'DELIVERED',
  '10': 'RETURNED',
  '11': 'RETURNED',
};

export interface NpTrackingStatus {
  ttn: string;
  statusCode: string;
  statusText: string;
  crmStatus: 'DELIVERED' | 'RETURNED' | null; // null = no change needed
  actualDeliveryDate?: string;
}

export async function getTrackingStatuses(
  ttns: string[],
  apiKey: string,
): Promise<NpTrackingStatus[]> {
  if (!ttns.length) return [];

  type NpDoc = {
    Number: string;
    StatusCode: string;
    Status: string;
    ActualDeliveryDate: string;
  };

  const result = await npPost<NpDoc>(
    'TrackingDocument',
    'getStatusDocuments',
    {
      Documents: ttns.map((ttn) => ({ DocumentNumber: ttn })),
    },
    apiKey,
  );

  if (!result.success) {
    throw new Error(`NP tracking error: ${result.errors.join(', ')}`);
  }

  return (result.data as NpDoc[]).map((doc) => ({
    ttn: doc.Number,
    statusCode: doc.StatusCode,
    statusText: doc.Status,
    crmStatus: NP_STATUS_MAP[doc.StatusCode] ?? null,
    actualDeliveryDate: doc.ActualDeliveryDate || undefined,
  }));
}

export interface NpSenderConfig {
  apiKey: string;
  senderRef: string;
  contactSenderRef: string;
  citySenderRef: string;
  senderAddressRef: string;
  senderPhone: string;
}

export interface CreateTtnParams {
  senderConfig: NpSenderConfig;
  recipientName: string;
  recipientPhone: string;
  npCityRef: string;
  npWarehouseRef: string;
  weight: number;
  cost: number;
  codAmount: number; // Cash on delivery. 0 = no COD
  description: string;
  seats: number;
  payerType: 'Recipient' | 'Sender';
}

interface NpCounterparty {
  Ref: string;
  ContactPerson: { data: Array<{ Ref: string }> };
}

interface NpInternetDocument {
  Ref: string;
  IntDocNumber: string;
  TypeDocument: string;
  CostOnSite: number;
  EstimatedDeliveryDate: string;
}

// Parse full name into FirstName/LastName for NP API
function parseName(fullName: string): { FirstName: string; LastName: string; MiddleName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    LastName: parts[0] ?? 'Клієнт',
    FirstName: parts[1] ?? 'Клієнт',
    MiddleName: parts[2] ?? '',
  };
}

// Create or get recipient counterparty in NP
async function ensureRecipientCounterparty(
  recipientName: string,
  recipientPhone: string,
  apiKey: string,
): Promise<{ counterpartyRef: string; contactRef: string }> {
  const { FirstName, LastName, MiddleName } = parseName(recipientName);
  const phone = recipientPhone.replace(/\D/g, '');

  const result = await npPost<NpCounterparty>(
    'Counterparty',
    'save',
    {
      FirstName,
      LastName,
      MiddleName,
      Phone: phone,
      Email: '',
      CounterpartyType: 'PrivatePerson',
      CounterpartyProperty: 'Recipient',
    },
    apiKey,
  );

  if (!result.success || !result.data[0]) {
    throw new Error(`NP: не вдалося створити отримувача. ${result.errors.join(', ')}`);
  }

  const cp = result.data[0];
  const contactRef = cp.ContactPerson?.data?.[0]?.Ref;

  if (!contactRef) {
    throw new Error('NP: не вдалося отримати контактну особу отримувача');
  }

  return { counterpartyRef: cp.Ref, contactRef };
}

export async function createTtn(params: CreateTtnParams): Promise<{
  ttn: string;
  ref: string;
  estimatedDelivery: string;
  cost: number;
}> {
  const { senderConfig, recipientName, recipientPhone, npCityRef, npWarehouseRef } = params;

  // Step 1: create/get recipient counterparty
  const { counterpartyRef, contactRef } = await ensureRecipientCounterparty(
    recipientName,
    recipientPhone,
    senderConfig.apiKey,
  );

  // Step 2: build TTN data
  const ttnData: Record<string, unknown> = {
    PayerType: params.payerType,
    PaymentMethod: 'Cash',
    CargoType: 'Cargo',
    Weight: String(params.weight),
    ServiceType: 'WarehouseWarehouse',
    SeatsAmount: String(params.seats),
    Description: params.description,
    Cost: String(params.cost),
    CitySender: senderConfig.citySenderRef,
    Sender: senderConfig.senderRef,
    SenderAddress: senderConfig.senderAddressRef,
    ContactSender: senderConfig.contactSenderRef,
    SendersPhone: senderConfig.senderPhone.replace(/\D/g, ''),
    CityRecipient: npCityRef,
    Recipient: counterpartyRef,
    RecipientAddress: npWarehouseRef,
    ContactRecipient: contactRef,
    RecipientsPhone: recipientPhone.replace(/\D/g, ''),
  };

  // COD (накладний платіж)
  if (params.codAmount > 0) {
    ttnData.BackwardDeliveryData = [
      {
        PayerType: 'Recipient',
        CargoType: 'Money',
        RedeliveryString: String(params.codAmount),
      },
    ];
  }

  // Step 3: create TTN
  const result = await npPost<NpInternetDocument>(
    'InternetDocument',
    'save',
    ttnData,
    senderConfig.apiKey,
  );

  if (!result.success || !result.data[0]) {
    logger.error('NP create TTN error:', result.errors);
    throw new Error(`NP: ${result.errors.join(', ')}`);
  }

  const doc = result.data[0];
  return {
    ttn: doc.IntDocNumber,
    ref: doc.Ref,
    estimatedDelivery: doc.EstimatedDeliveryDate,
    cost: doc.CostOnSite,
  };
}
