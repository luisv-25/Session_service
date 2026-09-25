import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

export interface ProviderRoom {
  providerRoomId: string;
  joinUrl: string | null; // null = modo simulado, no hay URL real que abrir
  isMock: boolean;
}

@Injectable()
export class DailyClient {
  private readonly logger = new Logger(DailyClient.name);
  private readonly apiKey = process.env.DAILY_API_KEY;
  private readonly baseUrl = "https://api.daily.co/v1";

  constructor(private readonly http: HttpService) {}

  async createRoom(bookingId: string): Promise<ProviderRoom> {
    if (!this.apiKey) {
      // Antes esto se disfrazaba con un dominio inventado
      // (meet.educonecta.demo) que nunca iba a resolver por DNS.
      // Ahora es explícito: no hay integración real configurada, y
      // join_url queda en null en vez de una URL falsa "clicable".
      this.logger.warn(
        "DAILY_API_KEY no configurada: creando sala en modo SIMULADO (sin video real).",
      );
      return {
        providerRoomId: `mock-room-${bookingId}`,
        joinUrl: null,
        isMock: true,
      };
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/rooms`,
          {
            properties: {
              exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3, // expira en 3h
              enable_chat: true,
            },
          },
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
            timeout: 5000,
          },
        ),
      );
      // Daily.co devuelve algo como:
      // { name: "abcd1234", url: "https://tu-subdominio.daily.co/abcd1234" }
      return {
        providerRoomId: data.name,
        joinUrl: data.url,
        isMock: false,
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(
        `Fallo al crear sala en Daily.co: ${axiosErr.message}. Cayendo a modo simulado.`,
      );
      return {
        providerRoomId: `mock-room-${bookingId}`,
        joinUrl: null,
        isMock: true,
      };
    }
  }

  // El plan gratuito de Daily cuenta salas CREADAS Y NO BORRADAS (máx. 50
  // simultáneas). Si no se borran al terminar la sesión, se acumulan y
  // Daily termina pidiendo tarjeta aunque no se haya superado el uso real.
  async deleteRoom(providerRoomId: string): Promise<void> {
    if (!this.apiKey || providerRoomId.startsWith("mock-room-")) return;

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/rooms/${providerRoomId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 5000,
        }),
      );
      this.logger.log(`Sala ${providerRoomId} borrada en Daily.co`);
    } catch (err) {
      const axiosErr = err as AxiosError;
      // No es crítico para el flujo de negocio (la sesión ya terminó de
      // todas formas); se registra para no dejarlo pasar en silencio.
      this.logger.warn(
        `No se pudo borrar la sala ${providerRoomId} en Daily.co: ${axiosErr.message}`,
      );
    }
  }
}
