import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import {
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly defaultTimeout = 30000;

  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    this.logger.log(`Fetching data from: ${url}`);

    try {
      const response = await axios.get<T>(url, {
        responseType: 'json',
        timeout: this.defaultTimeout,
        validateStatus: (status) => status < 500,
        ...config,
      });

      const status = response.status || 0;
      if (status >= 400) {
        this.handleHttpError(status, url);
      }

      if (response.data === null || response.data === undefined) {
        throw new BadRequestException(
          `The API at "${url}" returned empty data. Please ensure the API returns valid JSON data.`,
        );
      }

      return response;
    } catch (error) {
      this.handleAxiosError(error as AxiosError, url);
    }
  }

  private handleAxiosError(error: AxiosError, url: string): never {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new NotFoundException(
        `Cannot connect to "${url}". Please check if the URL is correct and the server is accessible.`,
      );
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new GatewayTimeoutException(
        `Request to "${url}" timed out after ${this.defaultTimeout / 1000} seconds. The server may be slow or unresponsive. Please try again later.`,
      );
    }

    if (error.code === 'ERR_INVALID_URL') {
      throw new BadRequestException(
        `Invalid URL format: "${url}". Please provide a valid HTTP or HTTPS URL.`,
      );
    }

    if (error.response) {
      const status = error.response.status || 0;
      this.handleHttpError(status, url);
    }

    throw new BadRequestException(
      `Failed to fetch data from "${url}": ${error.message}. Please verify the URL is correct and accessible.`,
    );
  }

  private handleHttpError(status: number, url: string): never {
    if (status === 0 || !status) {
      throw new BadRequestException(
        `The API at "${url}" returned an invalid response. Please check the URL and try again.`,
      );
    }

    if (status === 404) {
      throw new NotFoundException(
        `The requested URL "${url}" was not found (404). Please check the URL.`,
      );
    }

    if (status >= 500) {
      throw new GatewayTimeoutException(
        `The API at "${url}" returned an error (${status}). The server may be temporarily unavailable.`,
      );
    }

    throw new BadRequestException(
      `The API at "${url}" returned an error (${status}). Please check the URL and try again.`,
    );
  }
}
