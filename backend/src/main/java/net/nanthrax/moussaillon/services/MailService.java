package net.nanthrax.moussaillon.services;

import java.util.Properties;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.mail.Authenticator;
import jakarta.mail.Message;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

@ApplicationScoped
public class MailService {

    @Inject
    Mailer mailer;

    public void sendHtml(String to, String subject, String body) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        if (societe != null && societe.smtpHost != null && !societe.smtpHost.isBlank()) {
            sendWithSmtp(societe, to, subject, body, "text/html; charset=UTF-8");
        } else {
            mailer.send(Mail.withHtml(to, subject, body));
        }
    }

    public void sendText(String to, String subject, String body) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        if (societe != null && societe.smtpHost != null && !societe.smtpHost.isBlank()) {
            sendWithSmtp(societe, to, subject, body, "text/plain; charset=UTF-8");
        } else {
            mailer.send(Mail.withText(to, subject, body));
        }
    }

    private void sendWithSmtp(SocieteEntity societe, String to, String subject, String body, String contentType) {
        int port = societe.smtpPort != null ? societe.smtpPort : (societe.smtpSsl ? 465 : 587);
        String from = societe.smtpFrom != null && !societe.smtpFrom.isBlank() ? societe.smtpFrom : societe.email;

        Properties props = new Properties();
        props.put("mail.smtp.host", societe.smtpHost);
        props.put("mail.smtp.port", String.valueOf(port));
        props.put("mail.smtp.auth", societe.smtpUser != null && !societe.smtpUser.isBlank() ? "true" : "false");
        if (societe.smtpSsl) {
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
            props.put("mail.smtp.socketFactory.port", String.valueOf(port));
        } else {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "false");
        }

        Session session;
        if (societe.smtpUser != null && !societe.smtpUser.isBlank()) {
            String password = societe.smtpPassword != null ? societe.smtpPassword : "";
            session = Session.getInstance(props, new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(societe.smtpUser, password);
                }
            });
        } else {
            session = Session.getInstance(props);
        }

        try {
            MimeMessage message = new MimeMessage(session);
            message.setFrom(new InternetAddress(from));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
            message.setSubject(subject, "UTF-8");
            message.setContent(body, contentType);
            Transport.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Échec de l'envoi de l'email via SMTP : " + e.getMessage(), e);
        }
    }
}
