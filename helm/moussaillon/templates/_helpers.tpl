{{/*
Chart name
*/}}
{{- define "moussaillon.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fullname
*/}}
{{- define "moussaillon.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "moussaillon.labels" -}}
helm.sh/chart: {{ include "moussaillon.name" . }}
app.kubernetes.io/name: {{ include "moussaillon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Image helper
*/}}
{{- define "moussaillon.image" -}}
{{- $registry := .global.imageRegistry -}}
{{- if $registry -}}
{{ $registry }}/{{ .image.repository }}:{{ .image.tag }}
{{- else -}}
{{ .image.repository }}:{{ .image.tag }}
{{- end -}}
{{- end }}
