import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  priority: number;
}

export interface AIAnalysisRequest {
  tenantId: string;
  type: string;
  input: string;
  context?: Record<string, any>;
}

export interface AIAnalysisResult {
  provider: string;
  result: any;
  confidence: number;
  tokens: number;
  cost: number;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private providers: AIProvider[] = [];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.loadProviders();
  }

  private loadProviders() {
    // Initialize providers from config
    this.providers = [
      {
        id: 'mimo',
        name: 'MiMo',
        baseUrl: this.config.get('AI_MIMO_URL', 'http://8.219.164.50'),
        apiKey: this.config.get('AI_MIMO_KEY', ''),
        model: this.config.get('AI_MIMO_MODEL', 'MiMo-V2-Free'),
        isActive: true,
        priority: 1,
      },
      {
        id: 'openai-compat',
        name: 'OpenAI Compatible',
        baseUrl: this.config.get('AI_OPENAI_COMPAT_URL', ''),
        apiKey: this.config.get('AI_OPENAI_COMPAT_KEY', ''),
        model: this.config.get('AI_OPENAI_COMPAT_MODEL', 'gpt-3.5-turbo'),
        isActive: false,
        priority: 2,
      },
      {
        id: 'ollama',
        name: 'Ollama',
        baseUrl: this.config.get('AI_OLLAMA_URL', 'http://localhost:11434'),
        apiKey: '',
        model: this.config.get('AI_OLLAMA_MODEL', 'llama2'),
        isActive: false,
        priority: 3,
      },
    ];
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const activeProviders = this.providers
      .filter(p => p.isActive && p.apiKey)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of activeProviders) {
      try {
        return await this.callProvider(provider, request);
      } catch (error) {
        this.logger.error(`Provider ${provider.name} failed:`, error);
        continue;
      }
    }

    throw new Error('All AI providers failed');
  }

  private async callProvider(provider: AIProvider, request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(request);

    const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: 'You are an AI assistant for a tech repair shop management system.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      provider: provider.name,
      result: this.parseResponse(content, request.type),
      confidence: this.calculateConfidence(content),
      tokens: data.usage?.total_tokens || 0,
      cost: this.calculateCost(data.usage?.total_tokens || 0, provider),
    };
  }

  private buildPrompt(request: AIAnalysisRequest): string {
    switch (request.type) {
      case 'ERROR_DIAGNOSIS':
        return `Analyze this error and provide diagnosis:
Error: ${request.input}
Context: ${JSON.stringify(request.context || {})}
Provide: cause, severity, solution, preventive measures.`;

      case 'REPAIR_SUGGESTION':
        return `Suggest repair steps for:
Device: ${request.context?.deviceBrand} ${request.context?.deviceModel}
Issue: ${request.input}
Provide: diagnosis steps, parts needed, estimated time, cost estimate.`;

      case 'PRODUCT_RECOMMENDATION':
        return `Recommend products for:
Customer need: ${request.input}
Available products: ${JSON.stringify(request.context?.products || [])}
Provide: recommendations with reasoning.`;

      default:
        return request.input;
    }
  }

  private parseResponse(content: string, type: string): any {
    try {
      // Try to parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    // Return raw content
    return { text: content };
  }

  private calculateConfidence(content: string): number {
    // Simple confidence calculation based on response quality
    let confidence = 0.5;

    if (content.length > 100) confidence += 0.1;
    if (content.includes('cause') || content.includes('solution')) confidence += 0.1;
    if (content.includes('step') || content.includes('Step')) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private calculateCost(tokens: number, provider: AIProvider): number {
    // Simple cost calculation (per 1000 tokens)
    const rates: Record<string, number> = {
      'mimo': 0,
      'openai-compat': 0.002,
      'ollama': 0,
    };

    return (tokens / 1000) * (rates[provider.id] || 0);
  }

  async getProviders() {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      priority: p.priority,
    }));
  }

  async updateProvider(id: string, updates: Partial<AIProvider>) {
    const index = this.providers.findIndex(p => p.id === id);
    if (index >= 0) {
      this.providers[index] = { ...this.providers[index], ...updates };
    }
    return this.providers[index];
  }

  async chat(tenantId: string, message: string, history?: Array<{ role: string; content: string }>) {
    const activeProvider = this.providers.find(p => p.isActive && p.apiKey);

    if (!activeProvider) {
      throw new Error('No active AI provider');
    }

    const messages = [
      ...(history || []),
      { role: 'user', content: message },
    ];

    const response = await fetch(`${activeProvider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeProvider.apiKey}`,
      },
      body: JSON.stringify({
        model: activeProvider.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.choices?.[0]?.message?.content || '',
      tokens: data.usage?.total_tokens || 0,
    };
  }
}
