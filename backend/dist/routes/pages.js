"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const ftp_1 = require("../services/ftp");
const router = (0, express_1.Router)();
// Create Page
router.post('/projects/:projectId/pages', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { name, slug, title, description, html, css, js } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }
        // Verify member permissions
        const userId = req.userId;
        const member = await db_1.prisma.projectMember.findFirst({
            where: { projectId, userId }
        });
        if (!member) {
            return res.status(403).json({ error: 'Not authorized on this project' });
        }
        const page = await db_1.prisma.page.create({
            data: {
                name,
                slug,
                title,
                description,
                html: html || '<div></div>',
                css: css || '',
                js: js || '',
                projectId
            },
            include: {
                project: true
            }
        });
        // Upload to FTP
        try {
            await (0, ftp_1.uploadSinglePageToFTP)(page.project.name, page.slug, page.html, page.css, page.js, page.isHomepage);
        }
        catch (ftpErr) {
            console.error("Failed to upload new page to FTP:", ftpErr);
        }
        return res.status(201).json(page);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Update Page Code / Content
router.put('/pages/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, slug, title, description, html, css, js, isHomepage } = req.body;
        const page = await db_1.prisma.page.findUnique({
            where: { id },
            include: { project: { include: { members: true } } }
        });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        const userId = req.userId;
        const isMember = page.project.members.some(m => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (isHomepage) {
            // Unset previous homepage in this project
            await db_1.prisma.page.updateMany({
                where: { projectId: page.projectId, isHomepage: true },
                data: { isHomepage: false }
            });
        }
        const updatedPage = await db_1.prisma.page.update({
            where: { id },
            data: {
                name: name !== undefined ? name : page.name,
                slug: slug !== undefined ? slug : page.slug,
                title: title !== undefined ? title : page.title,
                description: description !== undefined ? description : page.description,
                html: html !== undefined ? html : page.html,
                css: css !== undefined ? css : page.css,
                js: js !== undefined ? js : page.js,
                isHomepage: isHomepage !== undefined ? isHomepage : page.isHomepage
            }
        });
        // FTP Upload on Save
        try {
            await (0, ftp_1.uploadSinglePageToFTP)(page.project.name, updatedPage.slug, updatedPage.html, updatedPage.css, updatedPage.js, updatedPage.isHomepage);
        }
        catch (ftpErr) {
            console.error("Failed to upload page changes to FTP:", ftpErr);
        }
        return res.json(updatedPage);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Delete Page
router.delete('/pages/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const page = await db_1.prisma.page.findUnique({
            where: { id },
            include: { project: { include: { members: true } } }
        });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        const userId = req.userId;
        const isMember = page.project.members.some(m => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (page.isHomepage) {
            return res.status(400).json({ error: 'Cannot delete the homepage of a project' });
        }
        await db_1.prisma.page.delete({ where: { id } });
        return res.json({ message: 'Page deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.pageRouter = router;
