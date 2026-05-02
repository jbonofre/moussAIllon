package net.nanthrax.moussaillon.services;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.jboss.resteasy.reactive.RestForm;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Path("/images")
public class ImageResource {

    private static final java.nio.file.Path UPLOAD_DIR = java.nio.file.Path.of("./data/images");

    private void ensureUploadDir() throws IOException {
        if (!Files.exists(UPLOAD_DIR)) {
            Files.createDirectories(UPLOAD_DIR);
        }
    }

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response upload(@RestForm("files") List<FileUpload> files) throws IOException {
        ensureUploadDir();
        List<String> urls = new ArrayList<>();
        for (FileUpload file : files) {
            String originalName = file.fileName();
            String extension = "";
            int dotIndex = originalName.lastIndexOf('.');
            if (dotIndex > 0) {
                extension = originalName.substring(dotIndex);
            }
            String storedName = UUID.randomUUID() + extension;
            java.nio.file.Path target = UPLOAD_DIR.resolve(storedName);
            Files.copy(file.uploadedFile(), target, StandardCopyOption.REPLACE_EXISTING);
            urls.add("/api/images/" + storedName);
        }
        return Response.ok(urls).build();
    }

    @GET
    @Path("/{filename}")
    public Response serve(@PathParam("filename") String filename) throws IOException {
        java.nio.file.Path file = UPLOAD_DIR.resolve(filename);
        if (!Files.exists(file)) {
            throw new NotFoundException();
        }
        String contentType = Files.probeContentType(file);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }
        return Response.ok(Files.readAllBytes(file))
                .type(contentType)
                .header("Cache-Control", "public, max-age=86400")
                .build();
    }
}
