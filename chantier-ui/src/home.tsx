import { fetchWithAuth } from './api.ts';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Row, Card, Input, Button, Space, Divider, Tag, Modal, theme } from 'antd';
import {
    RobotOutlined, SendOutlined, QuestionCircleOutlined,
    AudioOutlined, AudioMutedOutlined
} from '@ant-design/icons';
import { useNavigation } from './navigation-context.tsx';

const { Paragraph } = Typography;
const { TextArea } = Input;

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type JsonRpcResponse = {
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
};

type ParsedInstruction = {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    query?: any;
    body?: any;
    translatedCommand: string;
};

type AiProvider = 'anthropic';
type AiMcpDirective = {
    action: 'reply' | 'mcp_call';
    message?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path?: string;
    query?: any;
    body?: any;
};

const extractJsonCandidate = (raw: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
        return '';
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return fenced[1].trim();
    }
    return trimmed;
};

const tryParseJsonForDisplay = (content: string) => {
    const candidate = extractJsonCandidate(content);
    if (!candidate.startsWith('{') && !candidate.startsWith('[')) {
        return null;
    }
    try {
        return JSON.parse(candidate);
    } catch (_err) {
        return null;
    }
};

const renderJsonNode = (
    value: any,
    depth = 0,
    colors: {
        border: string;
        nullValue: string;
        stringValue: string;
        numberValue: string;
        booleanValue: string;
        indexValue: string;
        keyValue: string;
        separatorValue: string;
    }
): React.ReactNode => {
    const nestedContainerStyle: React.CSSProperties = {
        marginLeft: depth > 0 ? 14 : 0,
        borderLeft: depth > 0 ? `2px solid ${colors.border}` : 'none',
        paddingLeft: depth > 0 ? 10 : 0
    };

    if (value === null) {
        return <span style={{ color: colors.nullValue }}>null</span>;
    }

    if (typeof value === 'string') {
        return <span style={{ color: colors.stringValue }}>"{value}"</span>;
    }

    if (typeof value === 'number') {
        return <span style={{ color: colors.numberValue }}>{value}</span>;
    }

    if (typeof value === 'boolean') {
        return <span style={{ color: colors.booleanValue }}>{String(value)}</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span>[]</span>;
        }
        return (
            <div style={nestedContainerStyle}>
                {value.map((item, index) => (
                    <div key={index} style={{ marginTop: 4 }}>
                        <span style={{ color: colors.indexValue, marginRight: 6 }}>[{index}]</span>
                        {renderJsonNode(item, depth + 1, colors)}
                    </div>
                ))}
            </div>
        );
    }

    const entries = Object.entries(value || {});
    if (entries.length === 0) {
        return <span>{'{}'}</span>;
    }

    return (
        <div style={nestedContainerStyle}>
            {entries.map(([ key, nestedValue ]) => (
                <div key={key} style={{ marginTop: 4 }}>
                    <span style={{ fontWeight: 600, color: colors.keyValue }}>{key}</span>
                    <span style={{ color: colors.separatorValue, margin: '0 6px' }}>:</span>
                    {renderJsonNode(nestedValue, depth + 1, colors)}
                </div>
            ))}
        </div>
    );
};

export default function Home() {
    const { navigate } = useNavigation();
    const { token } = theme.useToken();
    const initialAssistantMessage =
        "Bonjour, je suis moussAIllon, votre assistant de gestion de chantier naval.\n\n" +
        "Comment puis-je vous aider aujourd'hui ?\n\n";

    const [ prompt, setPrompt ] = useState('');
    const [ loading, setLoading ] = useState(false);
    const [ listening, setListening ] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [ mcpReady, setMcpReady ] = useState(false);
    const aiProvider: AiProvider = 'anthropic';
    const [ isHelpOpen, setIsHelpOpen ] = useState(false);
    const [ messages, setMessages ] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: initialAssistantMessage
        }
    ]);
    const chatMessagesRef = useRef<HTMLDivElement | null>(null);

    const mcpStatusColor = useMemo(() => mcpReady ? 'green' : 'orange', [ mcpReady ]);
    const jsonColors = useMemo(() => ({
        border: token.colorBorderSecondary,
        nullValue: token.colorTextDescription,
        stringValue: token.colorPrimary,
        numberValue: token.colorInfo,
        booleanValue: token.colorWarning,
        indexValue: token.colorTextSecondary,
        keyValue: token.colorText,
        separatorValue: token.colorTextDescription
    }), [ token ]);

    useEffect(() => {
        let mounted = true;
        initializeMcp()
            .then(() => {
                if (mounted) {
                    setMcpReady(true);
                }
            })
            .catch((error) => {
                if (!mounted) {
                    return;
                }
                setMcpReady(false);
                appendAssistantMessage(
                    "Connexion MCP impossible pour le moment: " +
                    (error?.message || 'erreur inconnue')
                );
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!chatMessagesRef.current) {
            return;
        }
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }, [ messages ]);

    const appendAssistantMessage = (content: string) => {
        setMessages((prev) => [ ...prev, { role: 'assistant', content } ]);
    };

    const appendUserMessage = (content: string) => {
        setMessages((prev) => [ ...prev, { role: 'user', content } ]);
    };

    const initializeMcp = async () => {
        await mcpRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'moussaillon-chantier-ui',
                version: '0.9-SNAPSHOT'
            }
        });
    };

    const mcpRequest = async (method: string, params: any): Promise<JsonRpcResponse> => {
        const response = await fetchWithAuth('/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            })
        });

        if (!response.ok) {
            throw new Error('Erreur HTTP ' + response.status);
        }

        const json = await response.json() as JsonRpcResponse;
        if (json.error) {
            throw new Error(json.error.message + (json.error.data ? ' - ' + JSON.stringify(json.error.data) : ''));
        }
        return json;
    };

    const callMcpTool = async (name: string, args: any) => {
        const json = await mcpRequest('tools/call', {
            name,
            arguments: args
        });
        return json.result;
    };

    const extractAiText = (payload: any): string => {
        if (!payload) {
            return '';
        }

        if (typeof payload === 'string') {
            return payload;
        }

        if (typeof payload.answer === 'string' && payload.answer.trim()) {
            return payload.answer;
        }

        if (typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message;
        }

        // Anthropic-like shape: { content: [{ type: "text", text: "..." }] }
        if (Array.isArray(payload.content)) {
            const textParts = payload.content
                .map((part: any) => {
                    if (typeof part === 'string') {
                        return part;
                    }
                    if (part && typeof part.text === 'string') {
                        return part.text;
                    }
                    return '';
                })
                .filter((part: string) => part.trim());
            if (textParts.length > 0) {
                return textParts.join('\n');
            }
        }

        // OpenAI-like shape: { choices: [{ message: { content: "..." } }] }
        if (Array.isArray(payload.choices) && payload.choices.length > 0) {
            const content = payload.choices[0]?.message?.content;
            if (typeof content === 'string' && content.trim()) {
                return content;
            }
        }

        try {
            return JSON.stringify(payload, null, 2);
        } catch (_err) {
            return String(payload);
        }
    };

    const callAiChat = async (provider: AiProvider, message: string) => {
        const response = await fetchWithAuth('/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider,
                message
            })
        });

        if (!response.ok) {
            const text = await response.text();
            if (text && text.trim()) {
                throw new Error(text);
            }
            if (response.status >= 500) {
                throw new Error('Service IA indisponible temporairement (HTTP ' + response.status + ').');
            }
            throw new Error('Erreur IA HTTP ' + response.status);
        }

        const raw = await response.text();
        if (!raw.trim()) {
            return '';
        }

        try {
            const payload = JSON.parse(raw);
            return extractAiText(payload);
        } catch (_err) {
            return raw;
        }
    };

    const askPlanner = async (userInput: string) => {
        const plannerPrompt = buildPlannerPrompt(userInput);
        try {
            const answer = await callAiChat(aiProvider, plannerPrompt);
            return {
                answer,
                providerUsed: aiProvider,
                fallbackUsed: false,
                errors: [] as string[]
            };
        } catch (primaryError: any) {
            return {
                answer: '',
                providerUsed: aiProvider,
                fallbackUsed: false,
                errors: [ primaryError?.message || 'Erreur Claude inconnue' ]
            };
        }
    };

    const parseAiDirective = (aiOutput: string): AiMcpDirective | null => {
        const candidate = extractJsonCandidate(aiOutput);
        if (!candidate.startsWith('{')) {
            return null;
        }
        try {
            const parsed = JSON.parse(candidate) as AiMcpDirective;
            if (!parsed || !parsed.action) {
                return null;
            }
            if (parsed.action === 'mcp_call' && parsed.method && parsed.path) {
                return parsed;
            }
            if (parsed.action === 'reply' && parsed.message) {
                return parsed;
            }
            return null;
        } catch (_err) {
            return null;
        }
    };

    const buildPlannerPrompt = (userInput: string) =>
        "Tu es un moussAIllon, un assistant de gestion de chantier naval.\n" +
        "Réponds UNIQUEMENT en JSON valide, sans texte hors JSON.\n" +
        "Si une action API est utile, renvoie:\n" +
        "{\"action\":\"mcp_call\",\"method\":\"GET|POST|PUT|DELETE\",\"path\":\"/...\",\"query\":{...},\"body\":{...}}\n" +
        "Sinon renvoie:\n" +
        "{\"action\":\"reply\",\"message\":\"...\"}\n" +
        "Règles: path doit commencer par '/'. N'invente pas de clé sensible.\n" +
        "Question utilisateur: " + userInput;

    const parseJsonInput = (value: string | undefined, errorPrefix: string) => {
        if (!value || !value.trim()) {
            return undefined;
        }
        try {
            return JSON.parse(value);
        } catch (_err) {
            throw new Error(errorPrefix + " invalide. Utilisez un JSON objet valide.");
        }
    };

    const resolveResourcePath = (input: string) => {
        const normalized = input.toLowerCase();
        if (normalized.includes('client')) {
            return '/clients';
        }
        if (normalized.includes('bateau')) {
            return '/bateaux';
        }
        if (normalized.includes('moteur')) {
            return '/moteurs';
        }
        if (normalized.includes('remorque')) {
            return '/remorques';
        }
        if (normalized.includes('forfait')) {
            return '/forfaits';
        }
        if (normalized.includes('service')) {
            return '/services';
        }
        if (normalized.includes('vente')) {
            return '/ventes';
        }
        if (normalized.includes('technicien') || normalized.includes('techniciens')) {
            return '/techniciens';
        }
        return null;
    };

    const extractJsonBlock = (input: string) => {
        const start = input.indexOf('{');
        if (start < 0) {
            return null;
        }
        const jsonCandidate = input.slice(start).trim();
        return jsonCandidate || null;
    };

    const tryParseNaturalLanguage = (input: string): ParsedInstruction | null => {
        const lower = input.toLowerCase().trim();

        if (!lower) {
            return null;
        }

        if (lower === 'resources' || lower === 'ressources' || lower.includes('liste des ressources')) {
            return {
                method: 'GET',
                path: '/_resources',
                translatedCommand: 'resources'
            };
        }

        const resourcePath = resolveResourcePath(lower);
        if (!resourcePath) {
            return null;
        }

        const idMatch = lower.match(/\b(\d+)\b/);
        const id = idMatch ? idMatch[1] : null;

        const isDelete = /\b(supprime|supprimer|delete|efface|retire)\b/.test(lower);
        if (isDelete && id) {
            return {
                method: 'DELETE',
                path: resourcePath + '/' + id,
                translatedCommand: 'DELETE ' + resourcePath + '/' + id
            };
        }

        const isCreate = /\b(cr[eé]e|ajoute|nouveau|nouvelle|insert)\b/.test(lower);
        if (isCreate) {
            const jsonBlock = extractJsonBlock(input);
            if (!jsonBlock) {
                throw new Error("Pour une création, ajoutez un JSON, ex: crée un client {\"prenom\":\"Jean\"}");
            }
            return {
                method: 'POST',
                path: resourcePath,
                body: parseJsonInput(jsonBlock, 'Le body'),
                translatedCommand: 'POST ' + resourcePath + ' ' + jsonBlock
            };
        }

        const isUpdate = /\b(modifie|modifier|mets?\s+a\s+jour|update)\b/.test(lower);
        if (isUpdate) {
            if (!id) {
                throw new Error('Pour une mise à jour, précisez un id, ex: modifie le client 12 {...}');
            }
            const jsonBlock = extractJsonBlock(input);
            if (!jsonBlock) {
                throw new Error("Pour une mise à jour, ajoutez un JSON, ex: modifie le client 12 {\"nom\":\"Dupont\"}");
            }
            return {
                method: 'PUT',
                path: resourcePath + '/' + id,
                body: parseJsonInput(jsonBlock, 'Le body'),
                translatedCommand: 'PUT ' + resourcePath + '/' + id + ' ' + jsonBlock
            };
        }

        const searchMatch = lower.match(/\b(cherche|recherche|trouve|filtre)\b/);
        if (searchMatch) {
            const explicitTerm = lower.match(/(?:cherche|recherche|trouve|filtre)\s+(.+)/);
            let q = explicitTerm ? explicitTerm[1] : '';
            q = q.replace(/\bdans\b.*$/, '').trim();
            q = q.replace(/\bles?\b|\bla\b|\ble\b|\bdes?\b|\bdu\b|\bde\b/g, ' ').replace(/\s+/g, ' ').trim();
            if (!q) {
                throw new Error("Précisez un terme de recherche, ex: cherche dupont dans les clients");
            }
            return {
                method: 'GET',
                path: resourcePath + '/search',
                query: { q },
                translatedCommand: 'GET ' + resourcePath + '/search ' + JSON.stringify({ q })
            };
        }

        const isList = /\b(liste|affiche|montre|voir|consulte)\b/.test(lower);
        if (isList) {
            return {
                method: 'GET',
                path: resourcePath,
                translatedCommand: 'GET ' + resourcePath
            };
        }

        if (id) {
            return {
                method: 'GET',
                path: resourcePath + '/' + id,
                translatedCommand: 'GET ' + resourcePath + '/' + id
            };
        }

        return null;
    };

    const executeApiInstruction = async (instruction: ParsedInstruction) => {
        if (instruction.path === '/_resources') {
            const toolResult = await callMcpTool('moussaillon_list_api_resources', {});
            const firstContent = toolResult?.content?.[0]?.text || '{}';
            appendAssistantMessage(firstContent);
            return;
        }

        appendAssistantMessage('Interprétation: `' + instruction.translatedCommand + '`');

        const args: any = {
            method: instruction.method,
            path: instruction.path
        };
        if (instruction.query !== undefined) {
            args.query = instruction.query;
        }
        if (instruction.body !== undefined) {
            args.body = instruction.body;
        }

        const toolResult = await callMcpTool('moussaillon_call_api_resource', args);
        const firstContent = toolResult?.content?.[0]?.text;
        if (firstContent) {
            appendAssistantMessage(firstContent);
            const destination = resolveUiRouteFromApiPath(instruction.path);
            if (destination) {
                navigate(destination);
            }
            return;
        }
        appendAssistantMessage(JSON.stringify(toolResult || {}, null, 2));
        const destination = resolveUiRouteFromApiPath(instruction.path);
        if (destination) {
            navigate(destination);
        }
    };

    const resolveUiRouteFromApiPath = (apiPath: string) => {
        const normalized = (apiPath || '').toLowerCase();
        const map: Array<{ match: string; route: string }> = [
            { match: '/clients', route: '/clients' },
            { match: '/bateaux', route: '/clients/bateaux' },
            { match: '/moteurs', route: '/clients/moteurs' },
            { match: '/remorques', route: '/clients/remorques' },
            { match: '/forfaits', route: '/forfaits' },
            { match: '/services', route: '/services' },
            { match: '/ventes', route: '/prestations' },
            { match: '/techniciens', route: '/techniciens' }
        ];
        const found = map.find((item) => normalized.includes(item.match));
        return found ? found.route : null;
    };

    const handleCommand = async (rawInput: string) => {
        const input = rawInput.trim();
        if (!input) {
            return;
        }

        appendUserMessage(input);

        const lower = input.toLowerCase();
        if (lower === 'help') {
            appendAssistantMessage(
                "Exemples:\n" +
                "- resources\n" +
                "- GET /clients\n" +
                "- GET /clients/search {\"q\":\"dupont\"}\n" +
                "- POST /clients {\"prenom\":\"Jean\",\"nom\":\"Dupont\"}\n" +
                "- liste les clients\n" +
                "- cherche dupont dans les clients\n" +
                "- supprime le client 12"
            );
            return;
        }

        if (lower === 'resources') {
            await executeApiInstruction({
                method: 'GET',
                path: '/_resources',
                translatedCommand: 'resources'
            });
            return;
        }

        const match = input.match(/^(GET|POST|PUT|DELETE)\s+(\S+)(?:\s+(.+))?$/i);
        if (!match) {
            const naturalLanguageInstruction = tryParseNaturalLanguage(input);
            if (naturalLanguageInstruction) {
                await executeApiInstruction(naturalLanguageInstruction);
                return;
            }

            const plannerRun = await askPlanner(input);
            const plannerAnswer = plannerRun.answer;

            if (!plannerAnswer || !plannerAnswer.trim()) {
                const details = plannerRun.errors.filter(Boolean).join(" | ");
                appendAssistantMessage(
                    "Commande non reconnue et IA indisponible.\n" +
                    "Détail: " + (details || "Aucune réponse de Claude") + "\n" +
                    "Vérifiez la configuration backend Claude (clé API, endpoint, réseau) ou utilisez GET/POST explicite."
                );
                return;
            }

            const directive = parseAiDirective(plannerAnswer);
            if (directive && directive.action === 'mcp_call' && directive.method && directive.path) {
                await executeApiInstruction({
                    method: directive.method,
                    path: directive.path,
                    query: directive.query,
                    body: directive.body,
                    translatedCommand: directive.method + ' ' + directive.path
                });
                return;
            }
            if (directive && directive.action === 'reply' && directive.message) {
                appendAssistantMessage(directive.message);
                return;
            }
            if (plannerAnswer.trim()) {
                appendAssistantMessage(plannerAnswer);
                return;
            }

            appendAssistantMessage(
                "La réponse IA n'a pas pu être interprétée.\n" +
                "Essayez une commande GET/POST explicite."
            );
            return;
        }

        const method = match[1].toUpperCase();
        const path = match[2];
        const payloadPart = match[3];

        const args: any = { method, path };
        if (method === 'GET' || method === 'DELETE') {
            const query = parseJsonInput(payloadPart, "Le parametre query");
            if (query !== undefined) {
                args.query = query;
            }
        } else {
            const body = parseJsonInput(payloadPart, 'Le body');
            if (body !== undefined) {
                args.body = body;
            }
        }

        await executeApiInstruction({
            method: args.method,
            path: args.path,
            query: args.query,
            body: args.body,
            translatedCommand: input
        });
    };

    const onToggleVoice = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
            return;
        }
        if (listening) {
            recognitionRef.current?.stop();
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.onstart = () => setListening(true);
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setPrompt((prev) => prev ? prev + ' ' + transcript : transcript);
        };
        recognitionRef.current = recognition;
        recognition.start();
    };

    const onSend = async () => {
        if (!prompt.trim() || loading) {
            return;
        }
        const currentPrompt = prompt;
        setPrompt('');
        setLoading(true);
        try {
            await handleCommand(currentPrompt);
        } catch (error: any) {
            appendAssistantMessage("Erreur: " + (error?.message || 'inconnue'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* AI Assistant Chat */}
            <Card
                style={{
                    borderRadius: 12,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    overflow: 'hidden',
                }}
                styles={{ header: { borderBottom: `1px solid ${token.colorBorderSecondary}` } }}
                title={
                    <Row align="middle" justify="space-between">
                        <Space>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'linear-gradient(135deg, #722ed1, #9254de)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <RobotOutlined style={{ color: '#fff', fontSize: 18 }} />
                            </div>
                            <div>
                                <span style={{ fontWeight: 600, fontSize: 15 }}>Assistant IA</span>
                                <Tag
                                    color={mcpStatusColor}
                                    style={{ marginLeft: 8, borderRadius: 10, fontSize: 11 }}
                                >
                                    {mcpReady ? 'Connecté' : 'En attente'}
                                </Tag>
                            </div>
                        </Space>
                        <Tag color="purple" style={{ borderRadius: 10 }}>Claude (Anthropic)</Tag>
                    </Row>
                }
            >

                <div
                    ref={chatMessagesRef}
                    style={{
                        height: 350,
                        maxHeight: 350,
                        overflowY: 'auto',
                        borderRadius: 10,
                        padding: 16,
                        background: token.colorFillQuaternary,
                    }}
                >
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            style={{
                                marginBottom: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                            }}
                        >
                            <span style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4, fontWeight: 500 }}>
                                {message.role === 'user' ? 'Vous' : 'moussAIllon'}
                            </span>
                            {(() => {
                                const parsedJson = message.role === 'assistant'
                                    ? tryParseJsonForDisplay(message.content)
                                    : null;
                                const bubbleBase: React.CSSProperties = {
                                    maxWidth: '85%',
                                    padding: '10px 14px',
                                    borderRadius: message.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    lineHeight: 1.6,
                                    fontSize: 14,
                                };
                                if (parsedJson) {
                                    return (
                                        <div style={{
                                            ...bubbleBase,
                                            background: token.colorFillTertiary,
                                            border: `1px solid ${token.colorBorderSecondary}`,
                                        }}>
                                            {renderJsonNode(parsedJson, 0, jsonColors)}
                                        </div>
                                    );
                                }
                                return (
                                    <div style={{
                                        ...bubbleBase,
                                        whiteSpace: 'pre-wrap',
                                        background: message.role === 'user' ? token.colorPrimary : token.colorFillTertiary,
                                        color: message.role === 'user' ? '#fff' : token.colorText,
                                    }}>
                                        {message.content}
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>

                <Divider style={{ margin: '16px 0 12px' }} />

                <Space direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={"Posez une question ou tapez une commande..."}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        style={{
                            background: token.colorBgContainer,
                            color: token.colorText,
                            borderRadius: 10,
                        }}
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                    />
                    <Row justify="space-between" align="middle">
                        <Space>
                            <Button icon={<QuestionCircleOutlined />} onClick={() => setIsHelpOpen(true)} style={{ borderRadius: 8 }}>
                                Aide
                            </Button>
                            <Button onClick={() => setPrompt('resources')} style={{ borderRadius: 8 }}>Resources</Button>
                            <Button
                                icon={listening ? <AudioMutedOutlined /> : <AudioOutlined />}
                                danger={listening}
                                onClick={onToggleVoice}
                                title={listening ? 'Arrêter l\'écoute' : 'Dicter un message'}
                                style={{ borderRadius: 8 }}
                            >
                                {listening ? 'Écoute...' : 'Voix'}
                            </Button>
                        </Space>
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            loading={loading}
                            onClick={onSend}
                            style={{ borderRadius: 8, paddingInline: 24 }}
                        >
                            Envoyer
                        </Button>
                    </Row>
                </Space>
            </Card>

            <Modal
                title="Aide du chatbot moussAIllon"
                open={isHelpOpen}
                onCancel={() => setIsHelpOpen(false)}
                onOk={() => setIsHelpOpen(false)}
                okText="Fermer"
                cancelButtonProps={{ style: { display: 'none' } }}
            >
                <Paragraph>
                    Le chatbot accepte des commandes API directes, du langage naturel et des questions libres.
                </Paragraph>
                <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                    {"Commandes directes:\n" +
                        "- resources\n" +
                        "- GET /clients/search {\"q\":\"dupont\"}\n" +
                        "- POST /clients {\"prenom\":\"Jean\",\"nom\":\"Dupont\"}\n" +
                        "- PUT /clients/1 {...}\n" +
                        "- DELETE /clients/1\n\n" +
                        "Langage naturel (FR):\n" +
                        "- liste les clients\n" +
                        "- cherche dupont dans les clients\n" +
                        "- supprime le client 12\n" +
                        "- crée un client {\"prenom\":\"Jean\",\"nom\":\"Dupont\"}\n\n" +
                        "Conseil: utilisez Shift+Entrée pour un retour à la ligne et Entrée pour envoyer."}
                </Paragraph>
            </Modal>
        </>
    );
}