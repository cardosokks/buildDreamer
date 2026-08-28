package com.builddreamer.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class BuildDreamerApplication {
    public static void main(String[] args) {
        SpringApplication.run(BuildDreamerApplication.class, args);
    }
}
